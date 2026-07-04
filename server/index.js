const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const otpGenerator = require('otp-generator');
const { User, Device, Cabinet, Order, connectDB } = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smart-locker-secret-key-phenikaa-2026';
const SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 10;

app.use(cors());
app.use(express.json());

const espDevices = new Map();
const webClients = new Map();

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
}

async function generateUniqueOTP() {
  let otp;
  do {
    otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
      digits: true
    });
    const existing = await Order.findOne({
      otpCode: otp,
      status: { $in: ['pending', 'delivered'] }
    });
    if (!existing) break;
  } while (true);
  return otp;
}

function getOTPExpiry() {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + OTP_EXPIRY_MINUTES);
  return expiry;
}

function notifyWebClient(userId, event, data) {
  const socketId = webClients.get(userId.toString());
  if (socketId) {
    io.to(socketId).emit(event, data);
    console.log(`[WS] Sent ${event} to user ${userId}`);
  }
}

function sendToESP32(macAddress, event, data) {
  const socketId = espDevices.get(macAddress);
  if (socketId) {
    io.to(socketId).emit(event, data);
    console.log(`[WS] Sent ${event} to ESP32 ${macAddress}`);
    return true;
  }
  console.log(`[WS] ESP32 ${macAddress} not connected`);
  return false;
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, phone, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const latitude = 20.9860;
    const longitude = 105.7882;

    const user = new User({
      username,
      phone: phone || null,
      password: hashedPassword,
      latitude,
      longitude
    });

    try {
      await user.save();
    } catch (dbErr) {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
    }

    const { password: _, ...userWithoutPassword } = user.toObject();
    res.json({ message: 'Đăng ký thành công', user: userWithoutPassword });
  } catch (err) {
    console.error('[Register Error]', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Người dùng không tồn tại' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Mật khẩu không chính xác' });
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    const { password: _, ...userWithoutPassword } = user.toObject();
    res.json({
      message: 'Đăng nhập thành công',
      user: userWithoutPassword,
      token
    });
  } catch (err) {
    console.error('[Login Error]', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.get('/api/devices', async (req, res) => {
  try {
    const devices = await Device.find();

    const devicesWithCabinets = await Promise.all(devices.map(async (device) => {
      const cabinets = await Cabinet.find({ deviceId: device._id });
      const totalCabinets = cabinets.length;
      const availableCabinets = cabinets.filter(c => c.userId === null).length;
      return {
        ...device.toObject(),
        totalCabinets,
        availableCabinets,
        cabinets
      };
    }));

    res.json(devicesWithCabinets);
  } catch (err) {
    console.error('[GetDevices Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sync-data', async (req, res) => {
  try {
    const { macAddress } = req.query;
    if (!macAddress) return res.status(400).json({ error: 'Missing macAddress' });

    const device = await Device.findOne({ macAddress });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const cabinetIds = (await Cabinet.find({ deviceId: device._id })).map(c => c._id);

    const orders = await Order.find({
      cabinetId: { $in: cabinetIds },
      status: 'delivered'
    }).populate('cabinetId');

    const syncData = orders.map(o => ({
      cabinetPin: o.cabinetId.cabinetPin,
      otpCode: o.otpCode
    }));

    console.log(`[SYNC] Sent ${syncData.length} entries to ESP32 ${macAddress}`);
    res.json(syncData);
  } catch (err) {
    console.error('[SyncData Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync-from-esp', async (req, res) => {
  try {
    const { macAddress, cabinetPin } = req.body;

    const device = await Device.findOne({ macAddress });
    if (!device) return res.status(404).json({ success: false, error: 'Device not found' });

    const cabinet = await Cabinet.findOne({ deviceId: device._id, cabinetPin });
    if (!cabinet) return res.status(404).json({ success: false, error: 'Cabinet not found' });

    cabinet.userId = null;
    await cabinet.save();

    const order = await Order.findOne({ cabinetId: cabinet._id, status: 'delivered' });
    if (order) {
      order.status = 'completed';
      order.otpCode = null;
      await order.save();
      console.log(`[SYNC-ESP] Order ${order._id} completed, cabinet released`);

      notifyWebClient(order.userId, 'order_updated', {
        orderId: order._id,
        status: 'completed',
        message: 'Đã nhận hàng thành công!'
      });
      notifyWebClient(order.userId, 'notification', {
        type: 'success',
        message: 'Bạn đã nhận hàng thành công từ tủ đồ!'
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[SyncFromESP Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userId = req.userId;

    if (!deviceId) return res.status(400).json({ error: 'Thiếu deviceId' });

    const device = await Device.findById(deviceId);
    if (!device) return res.status(404).json({ error: 'Thiết bị không tồn tại' });

    const otpCode = await generateUniqueOTP();
    const otpExpiresAt = getOTPExpiry();

    const cabinet = await Cabinet.findOne({ deviceId, userId: null });
    if (!cabinet) {
      return res.status(400).json({ error: 'Không còn ngăn tủ trống tại trạm này' });
    }

    cabinet.userId = userId;
    await cabinet.save();

    const order = await Order.create({
      userId,
      deviceId,
      cabinetId: cabinet._id,
      otpCode,
      otpExpiresAt,
      status: 'pending'
    });

    console.log(`[ORDER] Created order ${order._id}, OTP: ${otpCode}, Cabinet: ${cabinet.cabinetName} (Pin ${cabinet.cabinetPin})`);

    res.json({
      message: 'Tạo đơn hàng thành công',
      order: {
        ...order.toObject(),
        cabinet: {
          _id: cabinet._id,
          cabinetName: cabinet.cabinetName,
          cabinetPin: cabinet.cabinetPin
        }
      }
    });
  } catch (err) {
    console.error('[CreateOrder Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const orders = await Order.find({ userId })
      .populate('cabinetId')
      .populate('deviceId', 'name macAddress')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error('[GetOrders Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/delivery', async (req, res) => {
  try {
    const { macAddress, otpCode } = req.body;
    console.log(`[ESP32] Nhận yêu cầu giao hàng - MAC: ${macAddress}, OTP: ${otpCode}`);
    const device = await Device.findOne({ macAddress });
    if (!device) {
      return res.status(400).json({ success: false, message: 'Thiết bị không hợp lệ' });
    }

    const order = await Order.findOne({
      otpCode,
      status: 'pending',
      deviceId: device._id
    }).populate('cabinetId');

    if (!order) {
      console.log(`[ESP32] Lỗi: Mã OTP không hợp lệ`);
      return res.status(400).json({ success: false, message: 'Mã OTP không hợp lệ' });
    }

    if (order.otpExpiresAt && new Date(order.otpExpiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: 'Mã OTP đã hết hiệu lực' });
    }
    const newPickupOTP = await generateUniqueOTP();
    const newOTPExpiry = getOTPExpiry();

    order.status = 'delivered';
    order.otpCode = newPickupOTP;
    order.otpExpiresAt = newOTPExpiry;
    await order.save();

    const cabinetPin = order.cabinetId.cabinetPin;
    console.log(`[ESP32] Thành công: Mở Cabinet Pin ${cabinetPin}`);
    console.log(`[ESP32] OTP nhận hàng mới: ${newPickupOTP}`);

    notifyWebClient(order.userId, 'notification', {
      type: 'info',
      message: `Hàng đã được giao vào ${order.cabinetId.cabinetName}! Mã nhận hàng: ${newPickupOTP}`
    });
    notifyWebClient(order.userId, 'order_updated', {
      orderId: order._id,
      status: 'delivered',
      otpCode: newPickupOTP
    });

    sendToESP32(macAddress, 'sync_request', {});

    res.json({
      success: true,
      boxNumber: cabinetPin === 13 ? 1 : 2,
      cabinetPin,
      message: 'Giao hàng thành công'
    });
  } catch (err) {
    console.error('[Delivery Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/orders/pickup', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.userId;
    const order = await Order.findOne({ _id: orderId, userId })
      .populate('cabinetId')
      .populate('deviceId');

    if (!order) {
      return res.status(404).json({ error: 'Đơn hàng không tồn tại hoặc không thuộc về bạn' });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Đơn hàng chưa được giao hoặc đã hoàn thành' });
    }
    order.status = 'completed';
    order.otpCode = null;
    await order.save();
    const cabinet = await Cabinet.findById(order.cabinetId._id);
    cabinet.userId = null;
    await cabinet.save();

    console.log(`[PICKUP] Order ${order._id} completed from web`);

    sendToESP32(order.deviceId.macAddress, 'open_cabinet', {
      cabinetPin: order.cabinetId.cabinetPin
    });

    notifyWebClient(userId, 'notification', {
      type: 'success',
      message: `Đã mở ${order.cabinetId.cabinetName}! Vui lòng lấy hàng.`
    });
    notifyWebClient(userId, 'order_updated', {
      orderId: order._id,
      status: 'completed'
    });

    res.json({
      success: true,
      message: 'Đã mở tủ thành công',
      cabinetName: order.cabinetId.cabinetName
    });
  } catch (err) {
    console.error('[Pickup Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/locker/verify-delivery', async (req, res) => {
  try {
    const { code, macAddress: mac } = req.body;
    const macAddress = mac || 'AA:BB:CC:DD:EE:FF';
    console.log(`[ESP32] Nhận yêu cầu giao hàng với mã: ${code}`);

    const device = await Device.findOne({ macAddress });
    if (!device) {
      return res.status(400).json({ success: false, message: 'Invalid device' });
    }

    const order = await Order.findOne({
      otpCode: code, status: 'pending', deviceId: device._id
    }).populate('cabinetId');

    if (!order) {
      console.log(`[ESP32] Lỗi: Mã không hợp lệ`);
      return res.status(400).json({ success: false, message: 'Invalid delivery code' });
    }

    if (order.otpExpiresAt && new Date(order.otpExpiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    const newPickupOTP = await generateUniqueOTP();
    order.status = 'delivered';
    order.otpCode = newPickupOTP;
    order.otpExpiresAt = getOTPExpiry();
    await order.save();

    const cabinetPin = order.cabinetId.cabinetPin;
    console.log(`[ESP32] Thành công: Mở Box Pin ${cabinetPin}`);

    notifyWebClient(order.userId, 'notification', {
      type: 'info',
      message: `Hàng đã được giao vào ${order.cabinetId.cabinetName}! Mã nhận hàng: ${newPickupOTP}`
    });
    notifyWebClient(order.userId, 'order_updated', {
      orderId: order._id, status: 'delivered', otpCode: newPickupOTP
    });
    sendToESP32(macAddress, 'sync_request', {});

    res.json({
      success: true,
      boxNumber: cabinetPin === 13 ? 1 : 2,
      cabinetPin,
      message: 'Box opened for delivery'
    });
  } catch (err) {
    console.error('[VerifyDelivery Error]', err);
    res.status(500).json({ success: false });
  }
});

app.post('/api/locker/verify-pickup', async (req, res) => {
  try {
    const { code, macAddress: mac } = req.body;
    console.log(`[ESP32] Nhận yêu cầu nhận hàng - OTP: ${code}`);

    let query = { otpCode: code, status: 'delivered' };
    if (mac) {
      const device = await Device.findOne({ macAddress: mac });
      if (!device) return res.status(400).json({ success: false, message: 'Invalid device' });
      query.deviceId = device._id;
    }

    const order = await Order.findOne(query).populate('cabinetId');
    if (!order) {
      return res.status(400).json({ success: false, message: 'Invalid pickup code' });
    }

    order.status = 'completed';
    order.otpCode = null;
    await order.save();

    const cabinet = await Cabinet.findById(order.cabinetId._id);
    cabinet.userId = null;
    await cabinet.save();

    const cabinetPin = order.cabinetId.cabinetPin;
    console.log(`[ESP32] Thành công: Mở Box Pin ${cabinetPin}`);

    notifyWebClient(order.userId, 'order_updated', {
      orderId: order._id, status: 'completed'
    });
    notifyWebClient(order.userId, 'notification', {
      type: 'success', message: 'Bạn đã nhận hàng thành công!'
    });

    res.json({
      success: true,
      boxNumber: cabinetPin === 13 ? 1 : 2,
      cabinetPin,
      message: 'Box opened for pickup'
    });
  } catch (err) {
    console.error('[VerifyPickup Error]', err);
    res.status(500).json({ success: false });
  }
});

app.post('/api/orders/cancel', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.userId;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) return res.status(404).json({ error: 'Đơn hàng không tồn tại' });

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Chỉ có thể huỷ đơn hàng đang chờ giao' });
    }

    order.status = 'cancelled';
    order.otpCode = null;
    await order.save();
    const cabinet = await Cabinet.findById(order.cabinetId);
    if (cabinet) {
      cabinet.userId = null;
      await cabinet.save();
    }

    console.log(`[CANCEL] Order ${order._id} cancelled`);

    notifyWebClient(userId, 'order_updated', {
      orderId: order._id, status: 'cancelled'
    });

    res.json({ message: 'Đơn hàng đã được huỷ thành công' });
  } catch (err) {
    console.error('[Cancel Error]', err);
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);
  socket.on('register_device', async (data) => {
    const { macAddress } = data;
    if (macAddress) {
      espDevices.set(macAddress, socket.id);
      await Device.updateOne({ macAddress }, { isOnline: true });
      console.log(`[WS] ESP32 registered: ${macAddress}`);
      socket.emit('registered', { success: true });
    }
  });

  socket.on('register_user', (data) => {
    const { userId } = data;
    if (userId) {
      webClients.set(userId, socket.id);
      console.log(`[WS] Web client registered: ${userId}`);
    }
  });

  socket.on('disconnect', async () => {
    for (const [mac, sid] of espDevices.entries()) {
      if (sid === socket.id) {
        espDevices.delete(mac);
        await Device.updateOne({ macAddress: mac }, { isOnline: false });
        console.log(`[WS] ESP32 disconnected: ${mac}`);
        break;
      }
    }
    for (const [uid, sid] of webClients.entries()) {
      if (sid === socket.id) {
        webClients.delete(uid);
        console.log(`[WS] Web client disconnected: ${uid}`);
        break;
      }
    }
  });
});

connectDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`  Smart Locker Backend Server`);
    console.log(`  HTTP:      http://0.0.0.0:${PORT}`);
    console.log(`  WebSocket: ws://0.0.0.0:${PORT}`);
    console.log(`========================================\n`);
  });
});
