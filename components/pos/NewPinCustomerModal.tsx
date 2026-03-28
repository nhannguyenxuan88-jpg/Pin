import React, { useState, useEffect } from "react";
import type { PinCustomer } from "../../types";
import { usePinContext } from "../../contexts/PinContext";

export const NewPinCustomerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (customer: PinCustomer) => void;
    initialName?: string;
    onToast?: (message: string, type: "success" | "error" | "warn" | "info") => void;
}> = ({ isOpen, onClose, onSave, initialName = "", onToast }) => {
    const [formData, setFormData] = useState<Omit<PinCustomer, "id">>({
        name: initialName,
        phone: "",
        address: "",
    });
    const { currentUser } = usePinContext();

    useEffect(() => {
        if (isOpen) {
            setFormData({ name: initialName, phone: "", address: "" });
        }
    }, [isOpen, initialName]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalCustomer: PinCustomer = {
            id: crypto.randomUUID(),
            ...formData,
        };
        if (!currentUser) {
            onToast?.("Bạn phải đăng nhập để thực hiện thao tác.", "warn");
            return;
        }
        onSave(finalCustomer);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex justify-center items-center p-4">
            <div className="bg-white dark:bg-pin-gray-900 rounded-lg shadow-xl w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <h2 className="text-2xl font-bold text-pin-gray-800 dark:text-pin-gray-100 mb-6">
                            Thêm Khách hàng mới
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-pin-gray-700 dark:text-pin-gray-300">
                                    Tên khách hàng (*)
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="mt-1 block w-full px-3 py-2 bg-white dark:bg-pin-gray-800 border border-pin-gray-300 dark:border-pin-gray-600 rounded-md"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-pin-gray-700 dark:text-pin-gray-300">
                                    Số điện thoại (*)
                                </label>
                                <input
                                    type="text"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="mt-1 block w-full px-3 py-2 bg-white dark:bg-pin-gray-800 border border-pin-gray-300 dark:border-pin-gray-600 rounded-md"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-pin-gray-700 dark:text-pin-gray-300">
                                    Địa chỉ
                                </label>
                                <input
                                    type="text"
                                    name="address"
                                    value={formData.address || ""}
                                    onChange={handleChange}
                                    className="mt-1 block w-full px-3 py-2 bg-white dark:bg-pin-gray-800 border border-pin-gray-300 dark:border-pin-gray-600 rounded-md"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="bg-pin-gray-50 dark:bg-pin-gray-800 px-6 py-4 flex justify-end space-x-3 border-t border-pin-gray-200 dark:border-pin-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-pin-gray-200 text-pin-gray-800 dark:bg-pin-gray-700 dark:text-pin-gray-200 font-semibold py-2 px-4 rounded-lg"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={!currentUser}
                            title={!currentUser ? "Bạn phải đăng nhập để thêm khách hàng" : undefined}
                            className={`font-semibold py-2 px-4 rounded-lg ${currentUser
                                ? "bg-pin-blue-600 text-white"
                                : "bg-pin-blue-300 text-white/70 cursor-not-allowed"
                                }`}
                        >
                            Lưu
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
