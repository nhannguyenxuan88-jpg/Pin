import React from 'react';
import type { PinSale } from '../../types';
import { PrinterIcon, XMarkIcon } from './common/../common/Icons';

const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount);

interface PinReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    saleData: PinSale | null;
}

const PinReceiptModal: React.FC<PinReceiptModalProps> = ({ isOpen, onClose, saleData }) => {
    if (!isOpen || !saleData) return null;

    const handlePrint = () => {
        const printContents = document.getElementById('pin-receipt-content')?.innerHTML;
        const originalContents = document.body.innerHTML;
        if (printContents) {
            const printStyles = `
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&display=swap');
                    body { 
                        font-family: 'Be Vietnam Pro', sans-serif; 
                        color: #000;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        margin: 0;
                        padding: 10px;
                    }
                    * {
                        font-size: 10pt;
                    }
                </style>
            `;
            document.body.innerHTML = printStyles + printContents;
            window.print();
            document.body.innerHTML = originalContents;
            window.location.reload(); 
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 print:hidden">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm transform transition-all">
                <div id="pin-receipt-content" className="p-6 bg-white text-black">
                    <div className="text-center">
                        <h2 className="text-xl font-bold">PIN Corp</h2>
                        <p className="text-sm">HÓA ĐƠN BÁN LẺ</p>
                        <p className="text-xs mt-1">Ngày: {new Date(saleData.date).toLocaleString('vi-VN')}</p>
                        <p className="text-xs">Mã HĐ: {saleData.id}</p>
                    </div>
                    <div className="my-3 border-t border-dashed border-black"></div>
                    <div className="text-left text-sm mb-3">
                        <p><strong>Khách hàng:</strong> {saleData.customer.name}</p>
                        {saleData.customer.phone && <p><strong>Điện thoại:</strong> {saleData.customer.phone}</p>}
                        {saleData.customer.address && <p><strong>Địa chỉ:</strong> {saleData.customer.address}</p>}
                    </div>
                    <div className="my-3 border-t border-dashed border-black"></div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-black">
                                <th className="text-left py-1">Sản phẩm</th>
                                <th className="text-center py-1">SL</th>
                                <th className="text-right py-1">T.Tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {saleData.items.map(item => (
                                <tr key={item.productId}>
                                    <td className="py-1">{item.name}</td>
                                    <td className="text-center py-1">{item.quantity}</td>
                                    <td className="text-right py-1">{formatCurrency(item.sellingPrice * item.quantity)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="my-3 border-t border-dashed border-black"></div>
                    <div className="text-right space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span>Tạm tính:</span>
                            <span>{formatCurrency(saleData.subtotal)}</span>
                        </div>
                        {saleData.discount > 0 && (
                            <div className="flex justify-between">
                                <span>Giảm giá:</span>
                                <span>-{formatCurrency(saleData.discount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-base">
                            <span>TỔNG CỘNG:</span>
                            <span>{formatCurrency(saleData.total)}</span>
                        </div>
                    </div>
                    <div className="text-center mt-4 text-sm">
                        <p>Cảm ơn quý khách!</p>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 flex justify-end space-x-3 border-t dark:border-slate-700">
                    <button onClick={onClose} className="bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300">Đóng</button>
                    <button onClick={handlePrint} className="flex items-center bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-sky-700">
                        <PrinterIcon className="w-5 h-5 mr-2" /> In hóa đơn
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PinReceiptModal;