import React, { useState, useRef, useEffect } from "react";

export const SmartPriceInput: React.FC<{
    value: number;
    onUpdate: (val: number) => void;
    priceType: "retail" | "wholesale";
}> = ({ value, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState(value.toString());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLocalValue(value.toString());
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
        const parsed = parseInt(localValue.replace(/\D/g, ""), 10);
        if (!isNaN(parsed) && parsed >= 0) {
            onUpdate(parsed);
        } else {
            setLocalValue(value.toString()); // revert
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleBlur();
        } else if (e.key === "Escape") {
            setIsEditing(false);
            setLocalValue(value.toString());
        }
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="text"
                value={localValue}
                onChange={(e) => {
                    // Chỉ cho phép nhập số
                    const val = e.target.value.replace(/\D/g, "");
                    setLocalValue(val);
                }}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="w-24 px-2 py-1 text-sm border-2 border-pin-blue-500 rounded focus:outline-none dark:bg-pin-dark-200 dark:text-white"
                title="Nhập giá mới và nhấn Enter"
            />
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className="cursor-pointer group flex items-center gap-1 hover:bg-pin-gray-50 dark:hover:bg-pin-dark-300 px-2 py-1 rounded transition-colors"
            title="Nhấn để sửa giá"
        >
            <span className="font-medium text-pin-gray-900 dark:text-white">
                {formatCurrency(value)}
            </span>
            <span className="opacity-0 group-hover:opacity-100 text-[10px] text-pin-blue-500 transition-opacity">
                ✎
            </span>
        </div>
    );
};
