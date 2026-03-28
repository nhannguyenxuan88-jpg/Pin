import React from "react";
import { ShoppingCartIcon } from "../common/Icons";

interface FloatingCartButtonProps {
    count: number;
    total: number;
    onClick: () => void;
}

export const FloatingCartButton: React.FC<FloatingCartButtonProps> = ({
    count,
    total,
    onClick,
}) => {
    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

    return (
        <button
            onClick={onClick}
            className="fixed bottom-[72px] left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center justify-between gap-4 w-[calc(100%-32px)] md:hidden z-40 active:scale-95 transition-transform"
        >
            <div className="flex items-center gap-2">
                <div className="relative">
                    <ShoppingCartIcon className="w-6 h-6" />
                    <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold border border-white">
                        {count}
                    </span>
                </div>
                <span className="font-semibold text-sm">Xem giỏ hàng</span>
            </div>
            <span className="font-bold text-lg">{formatCurrency(total)}</span>
        </button>
    );
};
