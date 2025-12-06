// utils/notificationService.js
const pool = require("../config/db");

// 🔔 알림 생성 함수 (다른 API에서 호출 가능)
async function createNotification(userId, type, title, message) {
  const sql = `
    INSERT INTO Notifications (userId, type, title, message)
    VALUES (?, ?, ?, ?)
  `;
  await pool.query(sql, [userId, type, title, message]);
}

// 🔔 특정 유저 알림 목록 조회
async function getNotifications(userId) {
  const sql = `
    SELECT *
    FROM Notifications
    WHERE userId = ?
    ORDER BY createdAt DESC
  `;
  const [rows] = await pool.query(sql, [userId]);
  return rows;
}

// 🔔 알림 읽음 처리
async function markAsRead(notificationId, userId) {
  const sql = `
    UPDATE Notifications
    SET isRead = TRUE
    WHERE id = ? AND userId = ?
  `;
  await pool.query(sql, [notificationId, userId]);
}

// 🔔 전체 읽음 처리
async function markAllAsRead(userId) {
  const sql = `
    UPDATE Notifications
    SET isRead = TRUE
    WHERE userId = ?
  `;
  await pool.query(sql, [userId]);
}

// 🔔 알림 삭제
async function deleteNotification(notificationId, userId) {
  const sql = `
    DELETE FROM Notifications
    WHERE id = ? AND userId = ?
  `;
  await pool.query(sql, [notificationId, userId]);
}

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
};
