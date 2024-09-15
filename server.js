const express = require('express');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const session = require('express-session');
const passport = require('passport');
const bcrypt = require('bcrypt');
const {Strategy} = require('passport-local');
const cors = require('cors');
const pg = require('pg');
const e = require('express');
const app = express();
dotenv.config();
app.use(cors({
    origin:"*",
    methods: ["*"],
    credentials:true,
}))
const salt = 10;
const db = new pg.Client({
    user:"postgres",
    host:"localhost",
    password:"isbz1234",
    port:5432,
    database:'leatData'
});
db.connect();
app.use(session({
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{maxAge: 60 * 60 * 60 * 1000 * 24},
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json()); 

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
 

app.post("/register", async(req,res)=>{
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;
    try {
       const checkUserexist = await db.query("SELECT * FROM users WHERE email = $1",[email]);
       if(checkUserexist.rows.length > 0){
         console.log("this user already exists")
       }else{
        bcrypt.hash(password,salt,async(error,hash)=>{
            if(error){
                console.log('there was an error')
            }else{
                   const saveDatainDb = await db.query("INSERT INTO users (username,email,password,aistate) VALUES($1,$2,$3,$4)",[username,email,hash,20]);  
                 
             } 
         })
       }
    } catch (error) {
        res.json({response: "user exists" , database:"error with database"}); 
        console.log('this user already exists',error);
    }
   }) 
   passport.use(new Strategy({usernameField:"email"},async function verify(email, password,cb){
        
        try {
            const dataBase = await db.query("SELECT * FROM users WHERE email = $1 ",[email]);
            const dataBasePassword = await dataBase.rows[0].password;
            bcrypt.compare(password,dataBasePassword,async(error,result)=>{
                if(error){
                    res.json({response:"there was an error"});
                    cb(error);
                }else{
                    if(result){
                        const user = await dataBase.rows;
                        cb(null,user);
                    }else{
                        cb(null);
                    }
                }
            })
        } catch (error) {
            console.log({response: "user does not exists" , database:"error with database"}); 
        }
   }))
   app.post("/login",passport.authenticate('local',{
    successRedirect:"/loginsuccess",
    failureRedirect:"/loginfail",
   }))
   passport.serializeUser((user,cb)=>{
        cb(null,user);
   });
   passport.deserializeUser((user,cb)=>{
    cb(null,user);
   });
   let verifycookies = ""
   app.get("/loginsuccess",(req,res)=>{
        if(req.isAuthenticated()){
            if(req.user){
                res.json({reponse:"success", message:req.user});
                console.log("user Logged")
                verifycookies = {reponse:"success", message:req.user};
            }else{
                res.json({reponse:"fail"});
                console.log("user not logged") 
            }
        }else{
          res.json({reponse:"fail"});   
        }
        
   })
   app.get("/loginfail",(req,res)=>{
    res.json({reponse:"fail"});
    console.log("user not logged failed login in") 
})

let datauser = "";
let seletedSwitch = '';
app.post("/switchdata",async(req,res)=>{
    const switchValue = req.body.state.data; 
    const username = req.body.datas;
    datauser = username;
    console.log(username);
    const InsertSwitchdata = await db.query('UPDATE users SET switchstate = $1 WHERE username = $2 ',[switchValue, username]);
    const getSwitchdata = await db.query('SELECT * FROM users WHERE username = $1',[username]);
    selectedData = await getSwitchdata.rows[0].switchstate;
    res.json({result: getSwitchdata.rows[0].switchstate})
    console.log(req.body);  
});

let requestCounter = 0;
app.post('/getanswer',async(req,res)=>{
    console.log(verifycookies.message[0].username);
    const username = verifycookies.message[0].username;
    const aiState = await db.query("SELECT * FROM users WHERE username = $1",[username]);
    let subnumber =  aiState.rows[0].aistate;
    if(subnumber[0] > 0 ){ 
        const data = req.body.result;
        const prompt = data;
        const result = await model.generateContent(prompt);
        console.log(result.response.text());  
        res.json(result.response.text())
        subnumber--;
        let updateaistate = await db.query('UPDATE users SET aistate = $1 WHERE username = $2 ',[subnumber, username]);
    }else{ 
            res.json("Sorry, but you're out of your daily limit of requests") 
    }  
}); 
app.get("/turnOn",(req,res)=>{
    if(verifycookies){
        res.json(verifycookies)
    }else{
        res.json({reponse:"fail"})
    }
    
})
app.get('/getswitchvalue',async(req,res)=>{
    res.json(selectedData); 
})   
let selectedData = '';
app.post("/Selected",(req,res)=>{
   selectedData = req.body.data;
}) 
app.get("/getSelected", (req,res)=>{ 
    res.json(selectedData);
    console.log(selectedData)
})
   
const Port = process.env.PORT;
app.listen(Port,()=>{
    console.log(`this is running on ${Port}`) 
})