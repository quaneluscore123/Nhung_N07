import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CreditCard, ShoppingBag, ArrowLeft } from 'lucide-react';

export default function Checkout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handlePayment = async () => {
    setLoading(true);
    setError('');
    
    // Simulate payment processing delay
    setTimeout(async () => {
      try {
        const userData = localStorage.getItem('user');
        if (!userData) return navigate('/login');
        
        const user = JSON.parse(userData);
        const res = await axios.post('http://localhost:3000/api/orders', { userId: user.id });
        
        // Success, go back to dashboard
        navigate('/dashboard');
      } catch (err) {
        setError(err.response?.data?.error || 'Không có tủ trống. Vui lòng thử lại sau.');
        setLoading(false);
      }
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button 
        onClick={() => navigate('/dashboard')}
        className="flex items-center text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại
      </button>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-700 bg-slate-800/50">
          <h2 className="text-2xl font-bold flex items-center">
            <ShoppingBag className="w-6 h-6 mr-2 text-indigo-400" />
            Thanh toán dịch vụ Tủ đồ
          </h2>
          <p className="text-slate-400 mt-2">Phí thuê tủ đồ thông minh cho 1 lần giao nhận.</p>
        </div>
        
        <div className="p-6 space-y-6">
          {error && <div className="bg-red-500/20 text-red-400 p-4 rounded-lg border border-red-500/30">{error}</div>}
          
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 flex justify-between items-center">
            <div>
              <p className="font-medium">Gói cơ bản (1 Lần sử dụng)</p>
              <p className="text-sm text-slate-400">Tối đa 24 giờ</p>
            </div>
            <p className="text-xl font-bold text-indigo-400">10,000đ</p>
          </div>

          <div className="space-y-4">
            <p className="font-medium text-slate-300">Phương thức thanh toán (Mô phỏng)</p>
            <div className="grid grid-cols-2 gap-4">
              <button className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-indigo-500 bg-indigo-500/10 text-white">
                <CreditCard className="w-6 h-6 mb-2 text-indigo-400" />
                <span className="text-sm font-medium">Thẻ tín dụng</span>
              </button>
              <button className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-slate-700 bg-slate-800 text-slate-400 opacity-50 cursor-not-allowed">
                <span className="font-bold mb-2">VNPAY</span>
                <span className="text-sm font-medium">Đang bảo trì</span>
              </button>
            </div>
          </div>

          <button
            onClick={handlePayment}
            disabled={loading}
            className={`w-full py-3 rounded-lg font-bold text-white transition-all shadow-lg flex justify-center items-center ${
              loading ? 'bg-slate-600 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'
            }`}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang xử lý...
              </span>
            ) : (
              'Thanh toán 10,000đ & Nhận Mã'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
