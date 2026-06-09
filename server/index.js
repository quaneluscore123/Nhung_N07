const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// --- ROUTES ---

// 1. Auth: Đăng ký
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

  const id = uuidv4();
  db.run(`INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, 'user')`, [id, username, password], function (err) {
    if (err) return res.status(400).json({ error: 'Username may already exist' });
    res.json({ message: 'User registered successfully', userId: id });
  });
});

// 2. Auth: Đăng nhập
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ message: 'Login successful', user: { id: user.id, username: user.username } });
  });
});

// 3. Orders: Tạo đơn hàng
app.post('/api/orders', (req, res) => {
  const { userId } = req.body;

  // Random 4 digit code
  const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();
  const pickupCode = Math.floor(1000 + Math.random() * 9000).toString();

  // Tìm tủ trống (Box 1 hoặc Box 2)
  db.all(`SELECT boxNumber FROM orders WHERE status IN ('pending_delivery', 'delivered')`, [], (err, activeOrders) => {
    if (err) return res.status(500).json({ error: err.message });

    const usedBoxes = activeOrders.map(o => o.boxNumber);
    let boxNumber = null;
    if (!usedBoxes.includes(1)) boxNumber = 1;
    else if (!usedBoxes.includes(2)) boxNumber = 2;

    if (!boxNumber) return res.status(400).json({ error: 'No empty boxes available' });

    const orderId = uuidv4();
    db.run(
      `INSERT INTO orders (id, userId, deliveryCode, pickupCode, status, boxNumber) VALUES (?, ?, ?, ?, 'pending_delivery', ?)`,
      [orderId, userId, deliveryCode, pickupCode, boxNumber],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Order created', orderId, deliveryCode, pickupCode, boxNumber });
      }
    );
  });
});

// 4. Orders: Lấy danh sách
app.get('/api/orders', (req, res) => {
  const { userId } = req.query;
  const query = userId ? `SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC` : `SELECT * FROM orders ORDER BY createdAt DESC`;
  db.all(query, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 5. Locker API: Xác thực Giao hàng (Mở tủ để bỏ đồ vào)
app.post('/api/locker/verify-delivery', (req, res) => {
  const { code } = req.body; // Mã 4 số
  console.log(`[ESP32] Nhận yêu cầu giao hàng với mã: ${code}`);
  db.get(`SELECT * FROM orders WHERE deliveryCode = ? AND status = 'pending_delivery'`, [code], (err, order) => {
    if (err || !order) {
      console.log(`[ESP32] Lỗi: Mã không hợp lệ`);
      return res.status(400).json({ success: false, message: 'Invalid delivery code' });
    }

    // Cập nhật trạng thái thành delivered
    db.run(`UPDATE orders SET status = 'delivered' WHERE id = ?`, [order.id], (updateErr) => {
      if (updateErr) return res.status(500).json({ success: false });
      console.log(`[ESP32] Thành công: Mở Box ${order.boxNumber}`);
      // Trả về số Box cần mở
      res.json({ success: true, boxNumber: order.boxNumber, message: 'Box opened for delivery' });
    });
  });
});

// 6. Locker API: Xác thực Nhận hàng (Mở tủ để lấy đồ)
app.post('/api/locker/verify-pickup', (req, res) => {
  const { code } = req.body;
  console.log(`[ESP32] Nhận yêu cầu nhận hàng với mã: ${code}`);
  db.get(`SELECT * FROM orders WHERE pickupCode = ? AND status = 'delivered'`, [code], (err, order) => {
    if (err || !order) {
      console.log(`[ESP32] Lỗi: Mã không hợp lệ`);
      return res.status(400).json({ success: false, message: 'Invalid pickup code' });
    }

    // Cập nhật trạng thái thành picked_up
    db.run(`UPDATE orders SET status = 'picked_up' WHERE id = ?`, [order.id], (updateErr) => {
      if (updateErr) return res.status(500).json({ success: false });
      console.log(`[ESP32] Thành công: Mở Box ${order.boxNumber}`);
      res.json({ success: true, boxNumber: order.boxNumber, message: 'Box opened for pickup' });
    });
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Smart Locker Backend running on http://0.0.0.0:${port}`);
});
