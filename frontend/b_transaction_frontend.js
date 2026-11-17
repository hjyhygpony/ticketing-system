/*
 * B module frontend entry map (review-only).
 *
 * This file is intentionally not loaded by index.html, so the current app keeps
 * running exactly as before. It gives teammates a single place to see which
 * frontend code belongs to the B transaction module.
 *
 * Runtime implementation is still in app.js because the original frontend is a
 * single native-JS file with shared state, shared DOM references, and shared
 * delegated event handlers. Splitting the runtime safely would require a small
 * public app context first.
 */

window.B_TRANSACTION_FRONTEND = {
  owner: "B",
  scope: "购票、候补购票、查看订单、退票申请",

  stateFields: [
    "purchaseSession",
    "purchaseMode",
    "purchaseQuantity",
    "selectedSeatIds",
    "selectedZoneId",
    "orderStatusFilter",
    "ticketVisibleOrderId",
    "paymentMethods",
    "seatMap",
  ],

  apiEndpoints: [
    "GET /api/sessions/{session_id}/seats",
    "POST /api/seats/lock",
    "POST /api/seats/release",
    "POST /api/orders/quick",
    "POST /api/orders",
    "POST /api/orders/{order_id}/pay",
    "GET /api/orders",
    "GET /api/orders/{order_id}",
    "POST /api/orders/{order_id}/refund",
    "POST /api/waitlist",
    "GET /api/waitlist",
    "POST /api/waitlist/{waiting_id}/checkout",
  ],

  appJsFunctions: [
    "paymentMethodLabel",
    "savePaymentMethod",
    "getPaymentMethod",
    "orderStatusTone",
    "renderOrderPanel",
    "refreshOrders",
    "renderShowSessions",
    "joinWaitlist",
    "checkoutWaitlist",
    "renderSeatButtons",
    "purchaseMapSeats",
    "mapWidthBase",
    "seatZoneColor",
    "resetSeatMapView",
    "updateSeatMapView",
    "renderQuantityPurchase",
    "renderPurchasePanel",
    "openPurchasePanel",
    "renderPaymentPanel",
    "renderPurchaseSuccess",
    "confirmPurchase",
    "renderTicketQr",
    "openOrderDetail",
    "payExistingOrder",
    "refundOrder",
  ],

  delegatedEvents: [
    "[data-waitlist-session] 候补购票",
    "[data-waitlist-checkout] 候补去支付",
    "[data-order-filter] 订单状态筛选",
    "[data-order-detail] 查看订单",
    "[data-toggle-ticket] 查看/隐藏电子票",
    "[data-pay-existing] 继续支付",
    "[data-refund-order] 申请退票",
    "[data-zone-select] 选择分区",
    "[data-quantity-step] 调整按分区购票数量",
    "[data-seat-toggle] 选择/取消座位",
    "[data-zone-pick] 座位图切换分区",
    "[data-seat-zoom] 座位图缩放",
    "[data-seat-reset-view] 座位图复位",
    "[data-refresh-seats] 刷新座位状态",
    "[data-confirm-purchase] 确认订单",
    "#payOrderForm 支付",
    "#refundConfirmForm 确认退票",
  ],

  sourceFile: "frontend/app.js",
};
