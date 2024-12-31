const express = require('express');
const router = express.Router();
const path = require('path');

const passport = require('passport');

router.get('/', (req, res)=>{
    res.sendFile( path.join(__dirname, '/..', '/views/main.html') );
});

module.exports = router;