import React from "react";
import type { PinRepairOrder } from "../types";

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};
const thtdStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "8px",
  textAlign: "left",
};

export default function PrintRepairOrder({ order }: { order: PinRepairOrder }) {
  let materials: any[] = [];
  try {
    if (order.materialsUsed) {
      if (typeof order.materialsUsed === "string") {
        materials = JSON.parse(order.materialsUsed as any) as any[];
      } else {
        materials = order.materialsUsed as any[];
      }
    }
  } catch (e) {
    materials = [];
  }

  return (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: 20,
        color: "#111",
      }}
    >
      <h2 style={{ marginBottom: 8 }}>Hoá đơn sửa chữa</h2>
      <div style={{ marginBottom: 12 }}>
        <strong>Mã đơn:</strong> {order.id}
        <br />
        <strong>Ngày:</strong> {order.creationDate}
        <br />
        <strong>Khách hàng:</strong> {order.customerName} /{" "}
        {order.customerPhone}
        <br />
        <strong>Thiết bị:</strong> {order.deviceName || "Chưa rõ"}
        <br />
        <strong>Kỹ thuật viên:</strong> {order.technicianName || "-"}
        <br />
        <strong>Trạng thái:</strong> {order.status}
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Mô tả sự cố</strong>
        <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>
          {order.issueDescription}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Vật tư</strong>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thtdStyle}>Tên</th>
              <th style={thtdStyle}>Số lượng</th>
              <th style={thtdStyle}>Giá</th>
              <th style={thtdStyle}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {materials && materials.length > 0 ? (
              materials.map((m: any, idx: number) => (
                <tr key={idx}>
                  <td style={thtdStyle}>
                    {m.materialName || m.name || m.partName || m.partId || "-"}
                  </td>
                  <td style={thtdStyle}>{m.quantity ?? m.qty ?? 1}</td>
                  <td style={thtdStyle}>
                    {m.price ? Number(m.price).toLocaleString() : "-"}
                  </td>
                  <td style={thtdStyle}>
                    {m.price && m.quantity
                      ? Number(m.price * (m.quantity || 1)).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td style={thtdStyle} colSpan={4}>
                  Không có vật tư
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, textAlign: "right" }}>
        <div>
          <strong>Tổng tiền:</strong>{" "}
          {order.total ? Number(order.total).toLocaleString() : 0}
        </div>
        <div>
          <strong>Tiền công:</strong>{" "}
          {order.laborCost ? Number(order.laborCost).toLocaleString() : 0}
        </div>
        <div>
          <strong>Trạng thái thanh toán:</strong> {order.paymentStatus ?? "-"}
        </div>
      </div>

      <hr style={{ marginTop: 18, marginBottom: 8 }} />
      <div style={{ fontSize: 12, color: "#666" }}>
        In từ ứng dụng Pin - {new Date().toLocaleString()}
      </div>
    </div>
  );
}
