import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import {
  ArrowLeft, MapPin, Box, CheckCircle, Wifi, WifiOff, Copy
} from 'lucide-react';

const API_URL = 'http://localhost:3000';

export default function Checkout() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { addNotification } = useSocket();

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/devices`);
      setDevices(res.data);
      if (res.data.length > 0) {
        setSelectedDevice(res.data[0]);
      }
    } catch (err) {
      setError('Không thể tải danh sách trạm tủ đồ');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!selectedDevice) return;
    setCreating(true);
    setError('');

    try {
      const res = await axios.post(`${API_URL}/api/orders`, {
        deviceId: selectedDevice._id
      });

      setResult(res.data);
      addNotification({
        type: 'success',
        message: `Tạo đơn thành công! Mã OTP giao hàng: ${res.data.order.otpCode}`
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tạo đơn hàng');
    } finally {
      setCreating(false);
    }
  };

  const copyOTP = (otp) => {
    navigator.clipboard.writeText(otp);
    addNotification({ type: 'info', message: `Đã sao chép mã OTP: ${otp}` });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto space-y-6 mt-8">
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-emerald-500/20 overflow-hidden shadow-2xl">
          <div className="p-6 text-center border-b border-emerald-500/10 bg-emerald-500/5">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Tạo đơn thành công!</h2>
            <p className="text-slate-400 text-sm mt-1">Gửi mã OTP giao hàng cho Shipper</p>
          </div>

          <div className="p-6 space-y-4">
            {/* OTP giao hàng */}
            <div className="bg-slate-900/50 p-5 rounded-xl border border-indigo-500/20 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Mã OTP Giao Hàng</p>
              <div className="flex items-center justify-center gap-3">
                <p className="font-mono text-3xl font-bold tracking-[0.3em] text-indigo-400">
                  {result.order.otpCode}
                </p>
                <button
                  onClick={() => copyOTP(result.order.otpCode)}
                  className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-2">Hiệu lực trong 10 phút</p>
            </div>

            {/* Thông tin ngăn tủ */}
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Ngăn tủ</span>
                <span className="text-white font-semibold">{result.order.cabinet?.cabinetName}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-slate-400 text-sm">GPIO Pin</span>
                <span className="text-white font-mono">{result.order.cabinet?.cabinetPin}</span>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl">
              <p className="text-amber-400 text-xs">
                ⚠ Lưu ý: Mã OTP giao hàng chỉ có hiệu lực 10 phút. Sau khi Shipper giao hàng, hệ thống sẽ sinh mã OTP nhận hàng mới cho bạn.
              </p>
            </div>

            <button
              id="btn-back-dashboard"
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
            >
              Về Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Quay lại Dashboard
      </button>

      <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-700/50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Box className="w-5 h-5 text-indigo-400" />
            Tạo đơn nhận hàng
          </h2>
          <p className="text-slate-500 text-sm mt-1">Chọn trạm tủ đồ để đặt chỗ ngăn tủ</p>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Danh sách trạm tủ đồ (devices) */}
          <div>
            <label className="block text-slate-400 text-sm mb-3 font-medium">Chọn trạm tủ đồ</label>
            <div className="space-y-3">
              {devices.map(device => (
                <button
                  key={device._id}
                  onClick={() => setSelectedDevice(device)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${selectedDevice?._id === device._id
                      ? 'border-indigo-500/50 bg-indigo-500/5 ring-1 ring-indigo-500/30'
                      : 'border-slate-700/50 bg-slate-900/30 hover:border-slate-600/50'
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedDevice?._id === device._id
                          ? 'bg-indigo-500/20 text-indigo-400'
                          : 'bg-slate-800 text-slate-500'
                        }`}>
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{device.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">MAC: {device.macAddress}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 mb-1">
                        {device.isOnline ? (
                          <><Wifi className="w-3 h-3 text-emerald-400" /><span className="text-xs text-emerald-400">Online</span></>
                        ) : (
                          <><WifiOff className="w-3 h-3 text-slate-600" /><span className="text-xs text-slate-600">Offline</span></>
                        )}
                      </div>
                      <p className="text-xs">
                        <span className="text-emerald-400 font-semibold">{device.availableCabinets}</span>
                        <span className="text-slate-600">/{device.totalCabinets} trống</span>
                      </p>
                    </div>
                  </div>

                  {/* Danh sách ngăn tủ */}
                  {selectedDevice?._id === device._id && (
                    <div className="mt-3 pt-3 border-t border-slate-700/30 grid grid-cols-2 gap-2">
                      {device.cabinets.map(cab => (
                        <div
                          key={cab._id}
                          className={`p-2.5 rounded-lg text-xs ${cab.userId
                              ? 'bg-red-500/5 border border-red-500/20 text-red-400'
                              : 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-400'
                            }`}
                        >
                          <p className="font-medium">{cab.cabinetName}</p>
                          <p className="text-[10px] opacity-70 mt-0.5">
                            Pin {cab.cabinetPin} — {cab.userId ? 'Đã đặt' : 'Trống'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Thông tin */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Trạm đã chọn</span>
              <span className="text-white font-medium">{selectedDevice?.name || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Ngăn trống</span>
              <span className="text-emerald-400 font-medium">{selectedDevice?.availableCabinets || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">OTP hiệu lực</span>
              <span className="text-white">10 phút</span>
            </div>
          </div>

          <button
            id="btn-create-submit"
            onClick={handleCreateOrder}
            disabled={creating || !selectedDevice || selectedDevice.availableCabinets === 0}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Đang tạo đơn...
              </span>
            ) : (
              'Tạo đơn & Nhận mã OTP'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
