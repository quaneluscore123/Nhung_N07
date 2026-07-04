import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import {
  Package, Plus, Clock, CheckCircle, XCircle,
  Truck, Box, Copy, RefreshCw, AlertTriangle
} from 'lucide-react';

const API_URL = 'http://localhost:3000';

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useSocket();

  const fetchOrders = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/orders`);
      setOrders(res.data);
    } catch (err) {
      console.error('Fetch orders error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    const handleOrderUpdate = () => fetchOrders();
    window.addEventListener('order_updated', handleOrderUpdate);
    return () => window.removeEventListener('order_updated', handleOrderUpdate);
  }, [fetchOrders]);

  const handleCancel = async (orderId) => {
    if (!confirm('Bạn có chắc muốn huỷ đơn hàng này?')) return;
    setActionLoading(orderId);
    try {
      await axios.post(`${API_URL}/api/orders/cancel`, { orderId });
      addNotification({ type: 'success', message: 'Đã huỷ đơn hàng thành công!' });
      fetchOrders();
    } catch (err) {
      addNotification({ type: 'error', message: err.response?.data?.error || 'Lỗi khi huỷ đơn' });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePickup = async (orderId) => {
    setActionLoading(orderId);
    try {
      const res = await axios.post(`${API_URL}/api/orders/pickup`, { orderId });
      addNotification({ type: 'success', message: res.data.message });
      fetchOrders();
    } catch (err) {
      addNotification({ type: 'error', message: err.response?.data?.error || 'Lỗi khi nhận hàng' });
    } finally {
      setActionLoading(null);
    }
  };

  const copyOTP = (otp) => {
    navigator.clipboard.writeText(otp);
    addNotification({ type: 'info', message: `Đã sao chép mã OTP: ${otp}` });
  };

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    completed: orders.filter(o => o.status === 'completed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Đang chờ giao',
          icon: <Clock className="w-3.5 h-3.5" />,
          classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        };
      case 'delivered':
        return {
          label: 'Chờ nhận hàng',
          icon: <Truck className="w-3.5 h-3.5" />,
          classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
        };
      case 'completed':
        return {
          label: 'Hoàn thành',
          icon: <CheckCircle className="w-3.5 h-3.5" />,
          classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        };
      case 'cancelled':
        return {
          label: 'Đã huỷ',
          icon: <XCircle className="w-3.5 h-3.5" />,
          classes: 'bg-red-500/10 text-red-400 border-red-500/20'
        };
      default:
        return { label: status, icon: null, classes: '' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-slate-500 text-sm mt-0.5">Quản lý đơn hàng và tủ đồ của bạn</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchOrders}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-xl transition-all text-sm border border-slate-700/50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Làm mới
          </button>
          <button
            id="btn-create-order"
            onClick={() => navigate('/checkout')}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl transition-all text-sm font-medium shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> Tạo đơn mới
          </button>
        </div>
      </div>

      {/* Thống kê tổng quan */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Package className="w-5 h-5" />} label="Tổng đơn" value={stats.total} color="indigo" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Đang chờ" value={stats.pending} color="amber" />
        <StatCard icon={<Truck className="w-5 h-5" />} label="Chờ nhận" value={stats.delivered} color="blue" />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Hoàn thành" value={stats.completed} color="emerald" />
      </div>

      {/* Danh sách đơn hàng */}
      <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-400" /> Danh sách Đơn hàng
          </h3>
          <span className="text-xs text-slate-500">{orders.length} đơn</span>
        </div>

        <div className="divide-y divide-slate-700/30">
          {orders.length === 0 ? (
            <div className="p-12 text-center">
              <Box className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">Chưa có đơn hàng nào</p>
              <p className="text-slate-600 text-sm mt-1">Hãy tạo đơn mới để bắt đầu!</p>
            </div>
          ) : (
            orders.map(order => {
              const statusConfig = getStatusConfig(order.status);
              const cabinet = order.cabinetId;
              const device = order.deviceId;
              const isExpired = order.otpExpiresAt && new Date(order.otpExpiresAt) < new Date();

              return (
                <div key={order._id} className="p-4 hover:bg-slate-800/30 transition-all">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    {/* Thông tin đơn */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${statusConfig.classes}`}>
                          {statusConfig.icon} {statusConfig.label}
                        </span>
                        {order.status === 'pending' && isExpired && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-red-500/10 text-red-400 border border-red-500/20">
                            <AlertTriangle className="w-3 h-3" /> OTP hết hạn
                          </span>
                        )}
                      </div>
                      <p className="text-slate-300 text-sm">
                        {device?.name || 'Trạm tủ đồ'} — <strong className="text-white">{cabinet?.cabinetName || 'N/A'}</strong>
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        {new Date(order.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>

                    {/* OTP Display */}
                    <div className="flex items-center gap-3">
                      {order.status === 'pending' && order.otpCode && (
                        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 text-center min-w-[140px]">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Mã giao hàng</p>
                          <div className="flex items-center justify-center gap-2">
                            <p className="font-mono text-xl font-bold tracking-[0.2em] text-indigo-400">
                              {order.otpCode}
                            </p>
                            <button onClick={() => copyOTP(order.otpCode)} className="text-slate-500 hover:text-indigo-400 transition-colors">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {order.status === 'delivered' && order.otpCode && (
                        <div className="bg-slate-900/50 p-3 rounded-xl border border-emerald-500/20 text-center min-w-[140px]">
                          <p className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1">Mã nhận hàng</p>
                          <div className="flex items-center justify-center gap-2">
                            <p className="font-mono text-xl font-bold tracking-[0.2em] text-emerald-400">
                              {order.otpCode}
                            </p>
                            <button onClick={() => copyOTP(order.otpCode)} className="text-slate-500 hover:text-emerald-400 transition-colors">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {order.status === 'pending' && (
                        <button
                          id={`btn-cancel-${order._id}`}
                          onClick={() => handleCancel(order._id)}
                          disabled={actionLoading === order._id}
                          className="flex items-center gap-1 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all text-xs font-medium border border-red-500/20 disabled:opacity-50"
                        >
                          {actionLoading === order._id ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-t border-b border-red-400"></div>
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          Huỷ
                        </button>
                      )}

                      {order.status === 'delivered' && (
                        <button
                          id={`btn-pickup-${order._id}`}
                          onClick={() => handlePickup(order._id)}
                          disabled={actionLoading === order._id}
                          className="flex items-center gap-1 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-all text-xs font-medium border border-emerald-500/20 disabled:opacity-50"
                        >
                          {actionLoading === order._id ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-t border-b border-emerald-400"></div>
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          Nhận hàng
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colorMap = {
    indigo: 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 text-indigo-400',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-400',
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-400',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={colorMap[color].split(' ').pop()}>{icon}</span>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
