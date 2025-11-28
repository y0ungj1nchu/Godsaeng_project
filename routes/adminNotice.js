// routes/adminNotice.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, adminOnly } = require("../middleware/auth");

// ===========================================================
// 1) 공지사항 목록 조회
// GET /api/admin/notice
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
// 2) 공지사항 등록
// POST /api/admin/notice
// ===========================================================
router.post("/", authMiddleware, adminOnly, async (req, res) => {
  const { title, content } = req.body;
  const adminId = req.user.id;

  if (!title || !content) {
    return res.status(400).json({ message: "제목과 내용을 입력하세요." });
  }

  try {
    const sql = `
      INSERT INTO Announcements (adminId, title, content)
      VALUES (?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [adminId, title, content]);

    res.status(201).json({
      message: "공지사항 등록 성공",
      id: result.insertId,
      title,
      content
    });
  } catch (err) {
    console.error("공지사항 등록 오류:", err);
    res.status(500).json({ message: "공지사항 등록 실패" });
  }
});

// ===========================================================
// 3) 공지사항 수정
// PUT /api/admin/notice/:id
// ===========================================================
router.put("/:id", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  try {
    await pool.execute(
      "UPDATE Announcements SET title = ?, content = ? WHERE id = ?",
      [title, content, id]
    );

    res.json({ message: "공지사항 수정 성공" });
  } catch (err) {
    console.error("공지사항 수정 오류:", err);
    res.status(500).json({ message: "공지사항 수정 실패" });
  }
});

// ===========================================================
// 4) 공지사항 삭제
// DELETE /api/admin/notice/:id
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
