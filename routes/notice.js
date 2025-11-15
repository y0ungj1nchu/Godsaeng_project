
/**
 * 갓생 제조기 - 공지사항 API 라우터
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// ----------------------------------------------------------------
// [GET] /api/notice : 공지사항 목록 전체 조회
// ----------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const sql = `
      SELECT 
        a.id, 
        a.title, 
        a.content, 
        a.createdAt, 
        a.updatedAt, 
        u.nickname AS adminNickname 
      FROM Announcements a
      JOIN Users u ON a.adminId = u.id
      ORDER BY a.createdAt DESC
    `;
    const [rows] = await pool.execute(sql);
    res.status(200).json(rows);
  } catch (error) {
    console.error('공지사항 조회 API 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ----------------------------------------------------------------
// [GET] /api/notice/:id : 특정 공지사항 조회
// ----------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        a.id, 
        a.title, 
        a.content, 
        a.createdAt, 
        a.updatedAt, 
        u.nickname AS adminNickname 
      FROM Announcements a
      JOIN Users u ON a.adminId = u.id
      WHERE a.id = ?
    `;
    const [rows] = await pool.execute(sql, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: '공지사항을 찾을 수 없습니다.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('특정 공지사항 조회 API 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ----------------------------------------------------------------
// [POST] /api/notice : 새 공지사항 작성 (관리자)
// ----------------------------------------------------------------
router.post('/', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const adminId = req.user.id;
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: '제목과 내용을 모두 입력해주세요.' });
    }

    const sql = `
      INSERT INTO Announcements (adminId, title, content) 
      VALUES (?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [adminId, title, content]);
    
    res.status(201).json({ 
      message: '공지사항이 성공적으로 등록되었습니다.',
      noticeId: result.insertId 
    });
  } catch (error) {
    console.error('공지사항 작성 API 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ----------------------------------------------------------------
// [PUT] /api/notice/:id : 공지사항 수정 (관리자)
// ----------------------------------------------------------------
router.put('/:id', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: '제목과 내용을 모두 입력해주세요.' });
    }

    const checkSql = 'SELECT * FROM Announcements WHERE id = ?';
    const [checkRows] = await pool.execute(checkSql, [id]);
    if (checkRows.length === 0) {
      return res.status(404).json({ message: '수정할 공지사항을 찾을 수 없습니다.' });
    }

    const updateSql = `
      UPDATE Announcements 
      SET title = ?, content = ? 
      WHERE id = ?
    `;
    await pool.execute(updateSql, [title, content, id]);
    
    res.status(200).json({ message: '공지사항이 성공적으로 수정되었습니다.' });
  } catch (error) {
    console.error('공지사항 수정 API 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ----------------------------------------------------------------
// [DELETE] /api/notice/:id : 공지사항 삭제 (관리자)
// ----------------------------------------------------------------
router.delete('/:id', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const { id } = req.params;

    const checkSql = 'SELECT * FROM Announcements WHERE id = ?';
    const [checkRows] = await pool.execute(checkSql, [id]);
    if (checkRows.length === 0) {
      return res.status(404).json({ message: '삭제할 공지사항을 찾을 수 없습니다.' });
    }

    const deleteSql = 'DELETE FROM Announcements WHERE id = ?';
    await pool.execute(deleteSql, [id]);
    
    res.status(200).json({ message: '공지사항이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('공지사항 삭제 API 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
