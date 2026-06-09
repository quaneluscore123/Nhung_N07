import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Package, Plus, LogOut, CheckCircle, Clock } from 'lucide-react';

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }
    const u = JSON.parse(userData);
    setUser(u);
    fetchOrders(u.id);
    
    // Auto refresh every 5 seconds to get locker updates
    const interval = setInterval(() => fetchOrders(u.id), 5000);
    return () => clearInterval(interval);
  }, [navigate]);

  const fetchOrders = async (userId) => {
    try {
      const res = await axios.get(`http://localhost:3000/api/orders?userId=${userId}`);
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending_delivery':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3 mr-1"/> Đang chờ giao</span>;
      case 'delivered':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400"><Package className="w-3 h-3 mr-1"/> Chờ nhận hàng</span>;
      case 'picked_up':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1"/> Đã hoàn thành</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div>
          <h2 className="text-xl font-semibold">Xin chào, <span className="text-indigo-400">{user?.username}</span></h2>
          <p className="text-sm text-slate-400">Quản lý đơn hàng và tủ đồ của bạn</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => navigate('/checkout')}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4 mr-1" /> Tạo đơn mới
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4 mr-1" /> Thoát
          </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-semibold flex items-center"><Package className="w-5 h-5 mr-2 text-indigo-400" /> Danh sách Đơn hàng</h3>
        </div>
        <div className="divide-y divide-slate-700">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Chưa có đơn hàng nào. Hãy tạo đơn mới!</div>
          ) : (
            orders.map(order => (
              <div key={order.id} className="p-4 hover:bg-slate-750 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-sm text-slate-400">ID: {order.id.substring(0,8)}</span>
                    {getStatusBadge(order.status)}
                  </div>
                  <p className="text-slate-300 text-sm">
                    Ngăn tủ chỉ định: <strong className="text-white text-lg">Box {order.boxNumber}</strong>
                  </p>
                </div>
                
                <div className="flex flex-row gap-4 bg-slate-900 p-3 rounded-lg border border-slate-700 w-full md:w-auto">
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">MÃ GIAO HÀNG</p>
                    <p className={`font-mono text-xl font-bold tracking-widest ${order.status === 'pending_delivery' ? 'text-indigo-400' : 'text-slate-600 line-through'}`}>
                      {order.deliveryCode}
                    </p>
                  </div>
                  <div className="w-px bg-slate-700"></div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">MÃ NHẬN HÀNG</p>
                    <p className={`font-mono text-xl font-bold tracking-widest ${order.status === 'delivered' ? 'text-green-400' : (order.status === 'picked_up' ? 'text-slate-600 line-through' : 'text-slate-500')}`}>
                      {order.status === 'pending_delivery' ? '****' : order.pickupCode}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
