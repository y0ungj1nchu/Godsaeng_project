// routes/adminNotice.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, adminOnly } = require("../middleware/auth");
const { createNotification } = require("../utils/notificationService");

// ===========================================================
// 1) 전체 사용자 목록 가져오기 함수
// ===========================================================
async function getAllUsers() {
  const [rows] = await pool.execute(
    "SELECT id FROM Users WHERE role = 'USER'"
  );
  return rows;
}

// ===========================================================
// 2) 공지사항 목록 조회
// ===========================================================
router.get("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT A.id, A.title, A.content, A.createdAt, A.updatedAt,
             U.nickname AS adminNickname
      FROM Announcements A
      JOIN Users U ON A.adminId = U.id
      ORDER BY A.createdAt DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("공지사항 조회 오류:", err);
    res.status(500).json({ message: "공지사항 조회 실패" });
  }
});


// ===========================================================
// 3) 공지 등록 + 전체 사용자 알림 전송
// ===========================================================
router.post("/", authMiddleware, adminOnly, async (req, res) => {
  const { title, content } = req.body;
  const adminId = req.user.id;

  if (!title || !content) {
    return res.status(400).json({ message: "제목과 내용을 입력하세요." });
  }

  try {
    // 공지 생성
    const [result] = await pool.execute(
      `INSERT INTO Announcements (adminId, title, content) VALUES (?, ?, ?)`,
      [adminId, title, content]
    );

    // 🔔 전체 사용자 목록 가져오기
    const users = await getAllUsers();

    // 🔔 전체 사용자에게 알림 전송
    for (const u of users) {
      await createNotification(
        u.id,
        "notice_created",
        "새 공지사항이 등록되었습니다.",
        `공지 제목: ${title}`
      );
    }

    res.status(201).json({ message: "공지사항 등록 성공" });
  } catch (err) {
    console.error("공지사항 등록 오류:", err);
    res.status(500).json({ message: "공지사항 등록 실패" });
  }
});


// ===========================================================
// 4) 공지 수정 + 전체 사용자에게 알림 전송
// ===========================================================
router.put("/:id", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  try {
    await pool.execute(
      "UPDATE Announcements SET title = ?, content = ? WHERE id = ?",
      [title, content, id]
    );

    // 🔔 전체 사용자 목록 가져오기
    const users = await getAllUsers();

    // 🔔 전체 사용자에게 알림 전송
    for (const u of users) {
      await createNotification(
        u.id,
        "notice_updated",
        "공지사항이 수정되었습니다.",
        `수정된 제목: ${title}`
      );
    }

    res.json({ message: "공지사항 수정 성공" });
  } catch (err) {
    console.error("공지사항 수정 오류:", err);
    res.status(500).json({ message: "공지사항 수정 실패" });
  }
});


// ===========================================================
// 5) 공지 삭제
// ===========================================================
router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.execute(`DELETE FROM Announcements WHERE id = ?`, [id]);
    res.json({ message: "공지사항 삭제 성공" });
  } catch (err) {
    console.error("공지사항 삭제 오류:", err);
    res.status(500).json({ message: "공지사항 삭제 실패" });
  }
});

module.exports = router;
