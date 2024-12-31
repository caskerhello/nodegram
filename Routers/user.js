const express = require('express');
const router = express.Router();
const path = require('path');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const passport = require('passport');

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

router.post('/login', async (req, res, next)=>{
    // console.log("login");
    const {email, pwd} = req.body;
    const sql = 'select * from user where email=?';
    try{
        const connection = await getConnection();
        const [rows, field] = await connection.query(sql, [email] );
        
        if( rows.length >= 1 ){
            const result = await bcrypt.compare(pwd, rows[0].pwd);

            if( result ){
                const uniqueInt = Date.now();
                req.session[uniqueInt] = rows[0];
                // console.log("rows[0]:",rows[0]);
                
                res.cookie('session', uniqueInt, {httpOnly : true,path : '/'});
                res.json({msg:'ok'});
            }else{
                res.json( {msg:'비밀번호가 맞지 않습니다'} );
            }
        }else{
            res.json( {msg:'아이디가 없습니다'} );
        }
    }catch(err){
        next(err);
    }
});


router.get('/joinform', (req, res)=>{
    res.sendFile( path.join(__dirname, '/..', '/views/joinform.html') );
});


router.post('/join', async (req, res, next)=>{
    const {email, pwd, nick} = req.body;
    console.log("join");
    console.log(req.body);
    try{
        const connection = await getConnection();
        let sql = "select * from user where email=?";
        const [rows1, field1] = await connection.query(sql, [email]);
        sql = "select * from user where nickname=?";
        const [rows2, field2] = await connection.query(sql, [nick]);
        if(rows1.length>=1){
            return res.json({msg:'이메일이 중복됩니다'});
        }else if(rows2.length>=1){
            return res.json({msg:'닉네임이 중복됩니다'});
        }else{
            sql = "insert into user(email, nickname, pwd) values(?,?,?)";
            const hash = await bcrypt.hash(pwd, 12);  // pwd 암호화
            const result = await connection.query(sql, [email, nick, hash]);
            res.json({msg:'ok'});
        }
    }catch(err){
        next(err);
    }
});


router.get('/getLoginUser', async (req, res, next)=>{
    const loginUser = req.session[req.cookies.session];
    console.log("getLoginUser")
    console.log("loginUser:",req.session[req.cookies.session]);

    try{
        const connection = await getConnection();
        // 내가 follow 하는 유저들 : follwings 
        // follow_form 에서 나를 조회해서  follow_to  들을 추출합니다
        let sql = 'select * from follow where follow_from = ?';
        let [rows, fields] = await connection.query(sql, [loginUser.nickname]);

        // rows 는 {follow_from:값, follow_to:값}들로 구성된 객체 배열
        //let followings = rows.map((row)=>{
        //    return row.follow_to;
        //});  // rows 가 원래 배열이었기때문에 각 요소들로 실행되고 리턴된 데이터로 다시 배열이 구성되고 결과가  followings 변수에 저장됩니다
        let followings = (rows.length>=1) ? rows.map( (row)=>(row.follow_to) ) : [];
        //console.log( rows );
        //console.log( followings );

        sql = 'select * from follow where follow_to = ?';
        let [rows2, fields2] = await connection.query(sql, [loginUser.nickname]);
        let followers = (rows2.length>=1) ? rows2.map( (row)=>(row.follow_from) ) : [];
        
        res.json({loginUser:loginUser, followers:followers , followings:followings  });
    
    }catch(err){
        next(err);
    }
});



router.get('/logout', (req, res)=>{
    if(req.cookies.session){
        delete req.session[req.cookies.session]; 
        res.clearCookie('session', req.cookies.session ,{ httpOnly : true,   path : '/'  });
    }else{
        req.session.destroy();  // 세션 쿠키 한번에 삭제
    }
    res.redirect('/');
});


router.post('/follow', async (req, res, next)=>{
    const {follow_from, follow_to} = req.body;
    try{
        const connection = await getConnection();
        let sql = 'select * from follow where follow_from=? and follow_to=?';
        let [rows, fields1] = await connection.query( sql, [follow_from, follow_to]);
        if( rows.length >= 1){
            res.send('no');
        }else{
            sql = 'insert into follow(follow_from, follow_to) values(?,?)';
            let [result, fields2] = await connection.query( sql, [follow_from, follow_to]);
            connection.commit;
            res.send('ok');
        }
        
    }catch(err){
        next(err);
    }
});



router.post('/unfollow', async (req, res, next)=>{
    const {follow_from, follow_to} = req.body;
    try{
        const connection = await getConnection();
        let sql = 'delete from follow where follow_from=? and follow_to=?';
        let [result, fields] = await connection.query( sql, [follow_from, follow_to]);
        connection.commit;
        res.send('ok');        
    }catch(err){
        next(err);
    }
});



router.get('/kakao', passport.authenticate('kakao') );

router.get('/kakao/callback', 
    passport.authenticate('kakao', {   
        failureRedirect: '/main',    // 인증 & 회원가입 및 로그인 실패 했을때 이동할 주소
    }), 
    (req, res) => {
        // const uniqueInt = Date.now();
        // req.session[uniqueInt] = req.user;
        // res.cookie('session', uniqueInt, {httpOnly : true,path : '/'});

        const uniqueInt = Date.now();
        req.session[uniqueInt] = req.user;
        res.cookie('session', uniqueInt, {httpOnly : true,path : '/'});
        res.redirect('/user/editProfile');    // 성공했을때 이동할 주소
    }
);

router.get('/editProfile', (req,res)=>{
    res.sendFile( path.join(__dirname, '/..', '/views/editProfile.html') );

});


router.post('/updateProfile', async(req,res,next)=>{
    
    const{email, nickname, name, sns_id}=req.body;
    
    // console.log("updateProfile:",{email, nickname, name, sns_id});

    try{
        const connection = await getConnection();
        let sql = 'select * from user where email=?';
        let [rows, fields] = await connection.query(sql, [email]);

        if(rows.length>=1){
            return res.send('이메일 중복');
        }


        sql = 'select * from user where nickname=?';
        [rows, fields] = await connection.query(sql, [nickname]);

        if(rows.length>=1){
            return res.send('닉네임 중복');
        }

        let regix = email.match(/\w+@(\w+[.])+\w+/g)

        if(!regix){
            return res.send('정확한 이메일 입력');
        }

        sql = 'update user set email=?, nickname=?, name=? where sns_id=?'
        let [result] = await connection.query(sql, [email, nickname, name, sns_id]);
        
        
        req.session[req.cookies.session] = {email:email, nickname:nickname, name:name, sns_id:sns_id};

        console.log("email:",req.session[req.cookies.session])

        res.send('ok');




    }catch(err){
        next(err);
    }
})


module.exports = router;