/**
 * 갓생 제조기 - 단어 게임(Word Game) 관련 API 라우터
 */
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// 파일 업로드를 위한 multer 설정 (메모리에 임시 저장)
const upload = multer({ storage: multer.memoryStorage() });

// ----------------------------------------------------------------
// [GET] /api/words/template : 단어장 템플릿 파일 다운로드
// ----------------------------------------------------------------
router.get('/template', authMiddleware, (req, res) => {
    // 템플릿 파일의 내용 (Question,Answer 형식)
    const BOM = "\uFEFF";
    const templateData = BOM+"Question,Answer\n" +
                         "Apple,사과\n" +
                         "Banana,바나나\n" +
                         "Computer,컴퓨터\n";
    
    // 파일을 직접 보내주는 대신, 내용과 파일명을 함께 전송
    res.setHeader('Content-disposition', 'attachment; filename=word_template.csv');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.status(200).send(templateData);
});


// ----------------------------------------------------------------
// [POST] /api/words/upload : CSV 파일을 업로드하여 단어장 생성
// ----------------------------------------------------------------
router.post('/upload', authMiddleware, upload.single('wordFile'), async (req, res) => {
    const userId = req.user.id;
    // 프론트엔드에서 FormData에 'setTitle' 이름으로 단어장 제목을 함께 보내야 함
    const { setTitle } = req.body; 

    if (!req.file) {
        return res.status(400).json({ message: '업로드할 파일을 선택해주세요.' });
    }
    if (!setTitle) {
        return res.status(400).json({ message: '단어장 제목을 입력해주세요.' });
    }

    const words = [];
    // 업로드된 파일 버퍼를 스트림으로 변환하여 csv-parser로 파싱
    const stream = require('stream');
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    bufferStream
        .pipe(csv({ bom:true }))
        .on('data', (row) => {
            // CSV의 각 행(row)을 words 배열에 추가
            if (row.Question && row.Answer) {
                words.push({ question: row.Question, answer: row.Answer });
            }
        })
        .on('end', async () => {
            if (words.length === 0) {
                return res.status(400).json({ message: '파일에 유효한 단어가 없습니다. Question,Answer 형식을 확인해주세요.' });
            }

            // DB 작업을 위해 트랜잭션 시작
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                // 1. WordSets 테이블에 새로운 단어장 정보 추가
                const wordSetSql = 'INSERT INTO WordSets (userId, setTitle) VALUES (?, ?)';
                const [wordSetResult] = await connection.execute(wordSetSql, [userId, setTitle]);
                const newWordSetId = wordSetResult.insertId;

                // 2. 파싱된 단어들을 Words 테이블에 한 번에 추가 (Bulk Insert)
                const wordSql = 'INSERT INTO Words (wordSetId, question, answer) VALUES ?';
                const wordValues = words.map(word => [newWordSetId, word.question, word.answer]);
                await connection.query(wordSql, [wordValues]);
                
                // 모든 작업 성공 시 커밋
                await connection.commit();

                res.status(201).json({ 
                    message: `'${setTitle}' 단어장이 성공적으로 생성되었습니다.`, 
                    wordSetId: newWordSetId,
                    newSet: { // 🔴 프론트엔드 상태 즉시 업데이트를 위해 새 객체 반환
                        id: newWordSetId,
                        setTitle: setTitle,
                        createdAt: new Date().toISOString()
                    }
                });

            } catch (error) {
                await connection.rollback(); // 오류 발생 시 롤백
                console.error('단어장 업로드 API 오류:', error);
                res.status(500).json({ message: '서버 오류가 발생했습니다.' });
            } finally {
                connection.release(); // 커넥션 반납
            }
        });
});

// ----------------------------------------------------------------
// [GET] /api/words/wordsets : 내 모든 단어장 목록 조회
// ----------------------------------------------------------------
router.get('/wordsets', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    try {
        const sql = 'SELECT id, setTitle, createdAt FROM WordSets WHERE userId = ? ORDER BY createdAt DESC';
        const [wordSets] = await pool.execute(sql, [userId]);
        res.status(200).json(wordSets);
    } catch (error) {
        console.error('단어장 목록 조회 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// ----------------------------------------------------------------
// [GET] /api/words/wordsets/:id : 특정 단어장의 모든 단어 조회 (게임용)
// ----------------------------------------------------------------
router.get('/wordsets/:id', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const wordSetId = req.params.id;
    try {
        // 본인 소유의 단어장인지 먼저 확인
        const checkSql = 'SELECT id, setTitle FROM WordSets WHERE id = ? AND userId = ?'; // 🔴 setTitle도 함께 조회
        const [ownerCheck] = await pool.execute(checkSql, [wordSetId, userId]);
        if (ownerCheck.length === 0) {
            return res.status(404).json({ message: '단어장을 찾을 수 없거나 권한이 없습니다.' });
        }

        const sql = 'SELECT id, question, answer FROM Words WHERE wordSetId = ?';
        const [words] = await pool.execute(sql, [wordSetId]);
        
        // 🔴 프론트엔드에서 퀴즈 생성 로직을 단순화하기 위해 백엔드에서 보기(options) 생성
        const wordListForQuiz = words.map(word => {
            // 1. 정답
            const correct = word.answer;
            
            // 2. 오답 (자신을 제외한 다른 단어의 뜻)
            const wrongOptions = words
                .filter(w => w.id !== word.id)
                .map(w => w.answer);
            
            // 3. 오답 3개 무작위 추출 (단어 수가 4개 미만일 경우 중복 허용)
            let options = [correct];
            while(options.length < 4 && wrongOptions.length > 0) {
                 const randomIndex = Math.floor(Math.random() * wrongOptions.length);
                 const randomOption = wrongOptions.splice(randomIndex, 1)[0];
                 if (!options.includes(randomOption)) {
                     options.push(randomOption);
                 }
                 // 만약 단어 수가 2~3개 뿐이라 오답 풀이 부족하면 정답을 중복 추가 (방어 코드)
                 if (wrongOptions.length === 0 && options.length < 4) {
                     options.push(correct); 
                 }
            }

            return {
                word: word.question, // "Apple"
                correct: correct,    // "사과"
                options: options     // ["사과", "바나나", "컴퓨터", "비행기"]
            };
        });

        res.status(200).json({
            setName: ownerCheck[0].setTitle,
            wordList: wordListForQuiz // 퀴즈 형식으로 가공된 데이터
        });
    } catch (error) {
        console.error('단어 조회 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

router.delete('/wordsets/:id', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const wordSetId = req.params.id;
  
  const connection = await pool.getConnection(); // 트랜잭션 시작

  try {
    await connection.beginTransaction();

    // 1. 단어장이 현재 사용자의 소유인지 확인
    const [ownerRows] = await connection.execute(
      'SELECT userId FROM WordSets WHERE id = ?',
      [wordSetId]
    );

    if (ownerRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '단어장을 찾을 수 없습니다.' });
    }
    if (ownerRows[0].userId !== userId) {
      await connection.rollback();
      return res.status(403).json({ message: '삭제 권한이 없습니다.' });
    }

    // 2. 자식 레코드(Words) 삭제 (외래 키 제약)
    await connection.execute(
      'DELETE FROM Words WHERE wordSetId = ?',
      [wordSetId]
    );

    // 3. 부모 레코드(WordSets) 삭제
    await connection.execute(
      'DELETE FROM WordSets WHERE id = ? AND userId = ?',
      [wordSetId, userId]
    );

    // 4. 트랜잭션 커밋
    await connection.commit();

    res.json({ message: '단어장이 성공적으로 삭제되었습니다.' });

  } catch (error) {
    await connection.rollback(); // 오류 시 롤백
    console.error('단어장 삭제 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    connection.release(); // 커넥션 반환
  }
});


module.exports = router;