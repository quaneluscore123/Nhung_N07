const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

let mongoServer;

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  phone: { type: String, default: null },
  password: { type: String, required: true },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const deviceSchema = new mongoose.Schema({
  macAddress: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  isOnline: { type: Boolean, default: false },
}, { timestamps: true });

const Device = mongoose.model('Device', deviceSchema);

const cabinetSchema = new mongoose.Schema({
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  cabinetName: { type: String, required: true },
  cabinetPin: { type: Number, required: true },  // GPIO pin trên ESP32
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = trống
});

const Cabinet = mongoose.model('Cabinet', cabinetSchema);

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  cabinetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cabinet', required: true },
  otpCode: { type: String, default: null },
  otpExpiresAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['pending', 'delivered', 'completed', 'cancelled'],
    default: 'pending'
  },
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

async function seedData() {
  try {
    const adminCount = await User.countDocuments();
    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash('123456', 10);
      await User.create({
        username: 'admin',
        phone: '0912345678',
        password: hashedPassword,
        latitude: 20.9860,
        longitude: 105.7882,
      });
      console.log('\n✅ [DB] Đã tạo tài khoản mẫu:');
      console.log('   - Tài khoản: admin');
      console.log('   - Mật khẩu:  123456\n');
    }

    const deviceCount = await Device.countDocuments();
    if (deviceCount === 0) {
      const device = await Device.create({
        macAddress: 'AA:BB:CC:DD:EE:FF',
        name: 'Trạm Tủ Đồ - Tòa A Phenikaa',
        latitude: 20.9860,
        longitude: 105.7882,
      });

      await Cabinet.create({
        deviceId: device._id,
        cabinetName: 'Ngăn 1',
        cabinetPin: 13,
      });

      await Cabinet.create({
        deviceId: device._id,
        cabinetName: 'Ngăn 2',
        cabinetPin: 12,
      });

      console.log('✅ [DB] Đã khởi tạo 1 trạm thiết bị mẫu với 2 ngăn tủ');

      const adminUser = await User.findOne({ username: 'admin' });
      const cabinet1 = await Cabinet.findOne({ deviceId: device._id, cabinetName: 'Ngăn 1' });

      await Order.create({
        userId: adminUser._id,
        deviceId: device._id,
        cabinetId: cabinet1._id,
        status: 'completed'
      });
      console.log('✅ [DB] Đã khởi tạo 1 đơn hàng "Hoàn thành" mẫu');
    }
  } catch (err) {
    console.error('[DB] Lỗi khi tạo dữ liệu mẫu:', err);
  }
}

async function connectDB() {
  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri);
    console.log(`\n🚀 [DB] Đã kết nối thành công tới MongoDB In-Memory tại: ${mongoUri}`);

    await seedData();
  } catch (err) {
    console.error('❌ [DB] Lỗi kết nối MongoDB:', err);
    process.exit(1);
  }
}

module.exports = { User, Device, Cabinet, Order, connectDB };
