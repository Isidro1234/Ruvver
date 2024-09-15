const express = require('express');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const session = require('express-session');
const passport = require('passport');
const bcrypt = require('bcrypt');
const {Strategy} = require('passport-local');
const cors = require('cors');
const {createClient } = require('@supabase/supabase-js');
const app = express();
dotenv.config();
app.use(cors({
    origin:"*",
    methods: ["*"],
    credentials:true,
}))
const salt = 10;

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
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey)

app.post("/register", async(req,res)=>{
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;
    try {
        const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email',email)
        if (error) console.log('Error:', error)
        if(data.length > 0){
            console.log("this user already exists")  
        }else{
            bcrypt.hash(password,salt,async(error,hash)=>{
                if(error){
                    console.log('there was an error')
                }else{               
                        const { data, error } = await supabase
                        .from('users')
                        .insert([
                        { username: username, email: email, password: hash, aistate:20 },
                        ])
                        .select();
                        if (error) console.log('Error:', error)
                        else console.log('Data:', data)
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
            const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email',email)
            if (error) console.log('Error:', error);
            const dataBasePassword = await data[0].password;
            bcrypt.compare(password,dataBasePassword,async(error,result)=>{
                if(error){
                    res.json({response:"there was an error"});
                    cb(error);
                }else{
                    if(result){
                        const user = await data[0];
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
                console.log(req.user)
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
    const { Data, err } = await supabase
    .from('users')
    .update({ switchsate: switchValue })
    .eq('username', username)
    .select()
        
    const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username',username)
            if (error) console.log('Error:', error);
    const getSwitchdata = await data[0].switchsate;
    selectedData = await data[0].switchsate;
    res.json({result: getSwitchdata})
    console.log(req.body);  
});

let requestCounter = 0;
app.post('/getanswer',async(req,res)=>{
    console.log(verifycookies.message.username);
    const username = verifycookies.message.username;
    const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username',username)
    if (error) console.log('Error:', error);
    let subnumber =  data[0].aistate;
    if(subnumber[0] > 0 ){ 
        const data = req.body.result;
        const prompt = data;
        const result = await model.generateContent(prompt);
        console.log(result.response.text());  
        res.json(result.response.text())
        subnumber--;
        const { Data, err } = await supabase
        .from('users')
        .update({ aistate: subnumber })
        .eq('username', username)
        .select()
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