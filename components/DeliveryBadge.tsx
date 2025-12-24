import React from "react";
import { Badge } from "./ui/Badge";

export type DeliveryStatus = 'pending' | 'preparing' | 'shipping' | 'delivered' | 'cancelled';

interface DeliveryBadgeProps {
    status: DeliveryStatus;
    className?: string;
}

const STATUS_CONFIG: Record<DeliveryStatus, {
    label: string;
    variant: 'default' | 'primary' | 'success' | 'warning' | 'danger';
    icon?: string;
}> = {
    pending: {
        label: 'Chờ lấy hàng',
        variant: 'warning',
        icon: '⏳',
    },
    preparing: {
        label: 'Đang chuẩn bị',
        variant: 'primary',
        icon: '📦',
    },
    shipping: {
        label: 'Đang giao',
        variant: 'primary',
        icon: '🚚',
    },
    delivered: {
        label: 'Đã giao',
        variant: 'success',
        icon: '✓',
    },
    cancelled: {
        label: 'Đã hủy',
        variant: 'danger',
        icon: '✕',
    },
};

export function DeliveryBadge({ status, className }: DeliveryBadgeProps) {
    const config = STATUS_CONFIG[status];

    return (
        <Badge variant={config.variant} className={className}>
            {config.icon && <span className="mr-1">{config.icon}</span>}
            {config.label}
        </Badge>
    );
}

// Helper function to get next possible statuses
export function getNextDeliveryStatuses(currentStatus: DeliveryStatus): DeliveryStatus[] {
    switch (currentStatus) {
        case 'pending':
            return ['preparing', 'cancelled'];
        case 'preparing':
            return ['shipping', 'cancelled'];
        case 'shipping':
            return ['delivered', 'cancelled'];
        case 'delivered':
        case 'cancelled':
            return []; // Terminal states
        default:
            return [];
    }
}

// Helper to check if status can be updated
export function canUpdateDeliveryStatus(currentStatus: DeliveryStatus): boolean {
    return getNextDeliveryStatuses(currentStatus).length > 0;
}
