/**
 * 갓생 제조기 - 순공시간 (Study Log) 관리 API 라우터
 * - 스톱워치 시작 및 종료, 학습 기록 조회 담당
 */
const express = require('express');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { updateExpAndCheckLevelUp } = require('../utils/characterUtils');
const router = express.Router();

// ----------------------------------------------------------------
// [POST] /api/study/start : 순공시간 측정 시작
// ----------------------------------------------------------------
router.post('/start', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    try {
        const [existing] = await pool.execute(
            'SELECT id FROM StudyLogs WHERE userId = ? AND endTime IS NULL',
            [userId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: '이미 측정이 시작된 기록이 있습니다. 먼저 종료해주세요.' });
        }

        const sql = 'INSERT INTO StudyLogs (userId, startTime) VALUES (?, NOW())';
        const [result] = await pool.execute(sql, [userId]); 
        
        const logId = result.insertId;
        res.status(201).json({ 
            logId: logId,
            message: '순공시간 측정을 시작했습니다.' 
        });

    } catch (error) {
        console.error('순공시간 시작 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// ----------------------------------------------------------------
// [PUT] /api/study/stop/:logId : 순공시간 측정 종료 및 기록 업데이트
// ----------------------------------------------------------------
router.put('/stop/:logId', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const logId = req.params.logId;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction(); // 트랜잭션 시작

        const [logs] = await connection.execute(
            'SELECT startTime FROM StudyLogs WHERE id = ? AND userId = ? AND endTime IS NULL',
            [logId, userId]
        );

        if (logs.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: '진행 중인 학습 기록을 찾을 수 없거나 권한이 없습니다.' });
        }
        
        const startTime = new Date(logs[0].startTime);
        const endTime = new Date();
        
        const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        
        if (durationSeconds < 5) {
            // 5초 미만이면 기록하지 않고 롤백 (단, 로그 자체를 지우진 않음. 필요시 DELETE 추가)
            await connection.rollback(); 
            return res.status(200).json({ 
                message: '너무 짧은 시간(5초 미만)은 기록되지 않습니다.', 
                durationSeconds: 0 
            });
        }

        // --- (duration 계산을 DB에 맡김) ---
        // DB의 NOW()와 startTime을 직접 비교하여 duration을 계산하고 업데이트
        const [updateResult] = await connection.execute(
            `UPDATE StudyLogs SET endTime = NOW(), duration = TIMESTAMPDIFF(SECOND, startTime, NOW()) 
             WHERE id = ? AND userId = ?`,
            [logId, userId]
        );
        // -----------------------------------------

        // --- (방금 저장된 duration을 다시 가져옴) ---
        const [updatedLog] = await connection.execute(
            'SELECT duration FROM StudyLogs WHERE id = ?',
            [logId]
        );
        const savedDuration = updatedLog[0].duration;
        // ---------------------------------------------

        let levelUpInfo = null;
        const studyMinutes = Math.floor(savedDuration / 60); // 수정됨
        if (studyMinutes > 0) {
             const expAmount = studyMinutes; 
             // ⭐️ characterUtils 함수에 'connection'을 전달하여 트랜잭션을 유지
             levelUpInfo = await updateExpAndCheckLevelUp(userId, expAmount, connection); 
        }

        await connection.commit();
        
        res.status(200).json({ 
            message: '순공시간 측정을 종료하고 기록했습니다.',
            durationSeconds: savedDuration, // 수정됨
            durationMinutes: (savedDuration / 60).toFixed(2), // 수정됨
            levelUpInfo: levelUpInfo
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('순공시간 종료 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ----------------------------------------------------------------
// [GET] /api/study/summary : 학습 시간 요약 (오류 수정됨)
// ----------------------------------------------------------------
router.get('/summary', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. KST 기준 오늘 날짜 (YYYY-MM-DD)
    const todayKST = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 2. KST 기준 이번 주 월요일 (수정됨)
    const now = new Date();
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dayOfWeek = kstNow.getUTCDay(); // 0=Sun, 1=Mon...
    const offset = (dayOfWeek === 0 ? 6 : dayOfWeek - 1); // 월(0)~일(6)
    
    // --- (원본 날짜 훼손 방지) ---
    const startOfWeekKST = new Date(kstNow.getTime()); // kstNow 복제
    startOfWeekKST.setUTCDate(startOfWeekKST.getUTCDate() - offset); // 복제본 수정
    const weekStartKST = startOfWeekKST.toISOString().split('T')[0];
    // ---------------------------------------

    // --- (CONVERT_TZ 제거) ---
    // 3. 쿼리 실행 (startTime은 이미 KST이므로 DATE()만 사용)
    const [todayRows] = await pool.execute(
      `SELECT SUM(duration) as total 
       FROM StudyLogs 
       WHERE userId = ? AND DATE(startTime) = ?`,
      [userId, todayKST]
    );

    const [weekRows] = await pool.execute(
      `SELECT SUM(duration) as total 
       FROM StudyLogs 
       WHERE userId = ? AND DATE(startTime) >= ?`,
      [userId, weekStartKST]
    );
    // ---------------------------------------

    const todayStudy = todayRows[0]?.total || 0;
    const weekStudy = weekRows[0]?.total || 0;

    res.json({ todayStudy, weekStudy });

  } catch (error) {
    console.error('학습 요약 조회 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/study/current : 현재 진행 중인(멈추지 않은) 학습 세션 조회
router.get('/current', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    // endTime이 NULL인 기록을 찾음
    const [rows] = await pool.execute(
      'SELECT id, startTime FROM StudyLogs WHERE userId = ? AND endTime IS NULL ORDER BY startTime DESC LIMIT 1',
      [userId]
    );

    if (rows.length > 0) {
      // 찾으면 logId와 startTime을 반환
      res.json({
        activeSession: {
          logId: rows[0].id,
          startTime: rows[0].startTime // (예: '2025-11-02T16:30:00.000Z')
        }
      });
    } else {
      // 진행 중인 세션이 없음
      res.json({ activeSession: null });
    }

  } catch (error) {
    console.error('진행 중인 세션 조회 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;