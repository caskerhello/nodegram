const express = require('express');
const path = require('path');
const router = express.Router();

const fs = require('fs');
const mysql = require('mysql2/promise');
const multer = require('multer');
async function getConnection(){
    let connection = await mysql.createConnection(
        {
            host : 'localhost',
            user : 'root',
            password : 'adminuser',
            database : 'nodegram'
        }
    );
    return connection;
}

try {
    fs.readdirSync('uploads');
} catch (error) {
    console.error('uploads 폴더가 없어 uploads 폴더를 생성합니다.');
    fs.mkdirSync('uploads');
}

const uploadObj = multer({
    storage: multer.diskStorage({
      destination(req, file, done) {
        done(null, 'uploads/');
      },
      filename(req, file, done) {
        const ext = path.extname(file.originalname);
        done(null, path.basename(file.originalname, ext) + Date.now() + ext);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/imgup', uploadObj.single('img'), (req, res, next)=>{
    // console.log(req.file.filename);
    // console.log(req.file.originalname);
    res.json( { 
        savefilename:req.file.filename, 
        image:req.file.originalname 
    } );
});


router.get('/mainlist', (req, res)=>{
    res.sendFile( path.join(__dirname, '/..', '/views/mainlist.html') );
});

router.get('/feedWriteForm', (req, res)=>{
    res.sendFile( path.join(__dirname, '/..', '/views/feedWriteForm.html') );
});

const obj = multer();
router.post('/writeFeed', obj.single('img'), async (req, res)=>{
    const { content, writer, image, savefilename }=req.body;
    const connection = await getConnection();


    try{
        
        // feed 테이블에 레코드를 추가합니다
        let sql = "insert into feed(content, image, savefilename, writer) values(?,?,?,?)";
        const [result, field] = await connection.query(sql, [content, image, savefilename, writer] );
        feedid = result.insertId;
        console.log(`피드아이디 : ${feedid}`);

        // content 에서 해시테그를 분리합니다
        const hashtags = content.match(/(?<=#)[^\s#]+/g);
        console.log(`해시테그들 : ${hashtags}`);

        if( hashtags ){
            hashtags.map( async (tag, idx)=>{
                console.log(`------tag : ${tag}------------------------`);
                // tag 에 담긴 단어가  hashtag 테이블에 존재하는지 검색.
                sql = "select * from hashtag where word=?";
                let [rows, field] = await connection.query(sql, [tag]);
                let tagid = '';
                if( rows.length >= 1){ // 이미 존재하는 해시테그라면 그 word의 id만 추출 저장
                    tagid = rows[0].num;
                }else{ // 없는 해시테그면 레코드 추가하고 추가된 id 저장
                    sql = "insert into hashtag(word) values(?)";
                    let [result2, field] = await connection.query(sql, [tag]);
                    tagid = result2.insertId;
                }
                console.log(`테그아이디 : ${tagid}`);

                // hash_feed 테이블에 피드아이디와 테그아이디로 레코드를 추가
                sql = "insert into feed_hashtag(feed_id, hash_id) values(?,?)";
                let [result3, field3] = await connection.query(sql, [feedid, tagid]); 
            });
        }
        res.send('ok');
        connection.commit();
    }catch(err){
        console.log("에러발생. 롤백 됩니다.");
        connection.rollback();
        next(err);
    }
    // finally{
    //     connection.release();
    // }
});


router.get('/getFeedList', async (req, res, next)=>{
    try{
        const connection = await getConnection();
        const sql = 'select * from feed order by num desc';
        const [rows, fields] = await connection.query(sql);
        res.send(rows);
    }catch(err){
        next(err);
    }
});


router.post('/search', async(req, res, next)=>{
    const {word} = req.body;
    try{ 
        const connection = await getConnection();
        // word 를 hashTag 테이블에서 검색
        let sql = 'select * from hashtag where word=?';
        let [rows, fields] = await connection.query(sql, [word]);
        if( rows.length >= 1){
            // 검색된 word의 hashTag 테이블의 hash_id 로   hash_feed 테이블에서 검색
            // 검색된 hash_feed 테이블의 feed_id 로  feed 테이블 검색
            let wordid = rows[0].num;
            sql = 'select * from feed where num in( select feed_id from feed_hashtag where hash_id=? ) order by num desc';
            
            let [rows2, fields2] = await connection.query(sql, [wordid]);
            if(rows2.length >= 1){
                // 검색된 feed 들을 res  로 전송
                res.send(rows2);
            }else{
                res.send([]);
            }
        }else{
            res.send([]);
        }
    }catch(err){
        next(err);
    }
});

module.exports = router;