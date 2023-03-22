//pm2 start ./pm2-config.json
//pm2 logs 0

var path = require("path");
const express = require("express");
const app = express();
var url = require('url');   // url모듈 가져오기
const bcrypt = require("bcrypt-nodejs");
const PORT = 3001;
const cookieParser = require("cookie-parser");
const xlsx = require( "xlsx" );
const book = xlsx.utils.book_new();
const { setPassport, getPassport, getState } = require("./fnc/auth");
setPassport(app);
const passport = getPassport();
const requestIp = require("request-ip");
const multiparty = require('multiparty');
var fs = require('fs');
const pdf = require('pdf-parse');
const multer  = require('multer')

const axios = require('axios');
var pdfcrowd = require("pdfcrowd");
var client = new pdfcrowd.PdfToHtmlClient("demo", "ce544b6ea52a5621fb9d55f8b542d14d");

app.use("/js", express.static(path.join(__dirname, "/js")));
app.use("/vendor", express.static(path.join(__dirname, "/vendor")));
app.use("/css", express.static(path.join(__dirname, "/css")));
app.use("/scss", express.static(path.join(__dirname, "/scss")));
app.use("/img", express.static(path.join(__dirname, "/img")));


app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const cookieConfig = {
maxAge: 60 * 60 * 1000,
path: "/",
httpOnly: false,
};

const mysql2 = require("mysql2/promise");
const _pool = mysql2.createPool({
host: "61.76.6.163",
user: "root",
password: "root",
port: "49153",
dateStrings: "date",
connectionLimit: 100,
enableKeepAlive: true
});

async function _getConn() {
return await _pool.getConnection(async (conn) => conn);
}
async function asyncQuery(sql, params = []) {
const conn = await _getConn();
try {
const [rows, _] = await conn.query(sql, params);
conn.release();
return rows;
} catch (err) {
console.log(
  `!! asyncQuery Error \n::${err}\n[sql]::${sql}\n[Param]::${params}`
);
} finally {
conn.release();
}
return false;
}


// PDF 파일 이름
var name = '';
const storage = multer.diskStorage({
destination: function (req, file, cb) {
cb(null, 'uploads/')
},
filename: function (req, file, cb) {
const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
cb(null, file.originalname);
  name = file.originalname;
}
})


// var upload = multer({ dest: 'uploads/' });
var upload = multer({storage : storage, dest:'uploads/'});

app.listen(PORT, "0.0.0.0", () => {
console.log(`server started on PORT ${PORT} // ${new Date()}`);
});


app.get("/", async (req, res) => {

res.render("home")
});


app.get("/test/:type", async (req, res) => {

res.render(`pdftohtml/${req.params.type}`);
});

// 전체 현황
app.get("/status", async (req, res) => {
res.render("menu/status");
});

// 작업 지시
app.get("/work_order", async (req, res) => {
    
res.render("menu/work_order");
});


// 레이저
app.get("/laiser", async (req, res) => {
    let row = await asyncQuery(`SELECT a.no, 
									   a.customer, 
									   a.work_key, 
									   DATE_FORMAT(a.order_date, '%Y-%m-%d') as order_date ,
									   DATE_FORMAT(a.shipping_date, '%Y-%m-%d') as shipping_date , 
									   a.proc,
									   a.shipping,
									   a.status,
									   a.laiser_out_com,
									   a.bending_out_com,
									   a.welding_out_com,
									   a.process_out_com,
									   a.urgent_message,
									   a.work_no,
									   a.key_no,
									   b.work_qty,
									   b.quality,
									   b.thickness,
									   b.materials_max,
									   b.program_name,
									   b.file_name
								 FROM tech_in.process as a
								 LEFT JOIN tech_in.operation as b 
								 ON a.work_key = b.no
								 WHERE a.proc like "%L%" and a.status <= 19 and a.status >=10
								 ORDER BY a.no DESC
       `)
    res.render("menu/laiser", {row:row});
});


// 레이저 클릭할때 동적 html 생성하는 POST
app.post("/laiser_select", async (req, res) => {
	 let selected_row_wait = await asyncQuery(`SELECT b.no,
											   b.file_name,
											   b.key_no,
											   DATE_FORMAT(a.shipping_date, '%Y-%m-%d') as shipping_date , 
											   a.work_no,
											   b.quality,
											   b.thickness,
											   b.materials_max,
											   a.status 
										FROM     tech_in.process as a
										LEFT JOIN	tech_in.operation as b
										ON a.key_no  = b.key_no 
										WHERE a.key_no = '${req.body.key_no}' and a.status = 10
				   `)
	  let selected_row_ing = await asyncQuery(`SELECT b.no,
											   b.file_name,
											   b.key_no,
											   DATE_FORMAT(a.shipping_date, '%Y-%m-%d') as shipping_date , 
											   a.work_no,
											   b.quality,
											   b.thickness,
											   b.materials_max,
											   a.status 
										FROM     tech_in.process as a
										LEFT JOIN	tech_in.operation as b
										ON a.key_no  = b.key_no 
										WHERE a.key_no = '${req.body.key_no}' and a.status = 11
				   `)
	
res.send({
        selected_row_wait: selected_row_wait,
        selected_row_ing: selected_row_ing
    });
});


// 레이저 > 레이저 작업완료 POST
app.post("/detail_order_start", async (req, res) => {
  var chlist = [];
  var rows_name = [];
  chlist = req.body.check_arr.split(","); //앞에서 체크된 밸류들을 배열로 넣어주는 코드
  const chlist_unique = chlist.filter((element, index) => chlist.indexOf(element) === index);
    if(chlist_unique == '') //아무것도 선택하지 않았을때, 없다고 알려주는 이프문
		{
			res.send('nope')
			return;
		}
	
	for(var i = 0; i < chlist_unique.length; i++) //고른것 중에 작업중이 있는지 확인하는 쿼리, 하다가 작업중이 있으면 n 반환하고 종료
	  {
			  let valid_chlist = await asyncQuery(`	SELECT status
			  										FROM tech_in.operation  
                        							WHERE no = '${chlist_unique[i]}'`);  // 배열에 있는 작업중이 있는지 확인하는 쿼리
		  if(valid_chlist[0].status == 11)
			  {
				  res.send('n')
				  return;
			  }
	  }
	
  for(var i = 0; i < chlist_unique.length; i++)
	  {
		  let row = await asyncQuery(`UPDATE tech_in.operation 
                        SET status = '11' 
                        WHERE no = '${chlist_unique[i]}'`);  // 배열에 있는 번호들을 전부 UPDATE쳐서 status 변화 시키는 쿼리
	  }
	for (var i = 0; i < chlist_unique.length; i++) { //이름이 있는거 전부 다 담아서
	  const result = await asyncQuery(`SELECT customer_name FROM tech_in.operation WHERE no = '${chlist_unique[i]}'`);
	  rows_name.push(result[0]);
		}
	for (var i = 0; i <rows_name.length; i++){ //프로세스랑 이름 곂치면 상태 다 업데이트 해주는 코드
		let rows = await asyncQuery(`UPDATE tech_in.process
									 SET status = '11'
									 WHERE customer = '${rows_name[i].customer_name}'`)	// process 에 값을 업데이트 하는 쿼리		
	}
	 				 
res.send('y')
	
});

app.post("/detail_order_end", async (req, res) => {
  var chlist = [];
  var info_row = [];
  var all_row_count = [];	
  var fil_row_count = [];
  var process = [];
  var cnt = 0;
  chlist = req.body.check_arr.split(","); // 체크리스트의 값을 받는 쿼리
   if(chlist == '') //체크값이 있는지 업는지 확인하는 코드
	{
		res.send('nope')
		return;
	}
  for(var i = 0; i < chlist.length; i++) // 배열에 있는 작업중이 있는지 확인하는 쿼리
	  {
			  let valid_chlist = await asyncQuery(`	SELECT status
			  										FROM tech_in.operation  
                        							WHERE no = '${chlist[i]}'`); 
		  if(valid_chlist[0].status== 10 )
			  {
				 
				  res.send('n')
				  return;
			  }
	  }
  for(var i = 0; i < chlist.length; i++) // status 를 전부 12로 올려주는 쿼리
  {
	  let row = await asyncQuery(`UPDATE tech_in.operation 
							      SET status = '12' 
								  WHERE no = '${chlist[i]}'`); 
  }
	
 for(var i = 0; i < chlist.length; i++) //operation에서 값을 땡겨오기 위해 사전 준비 하는 쿼리
  {
	  const result = await asyncQuery(`SELECT key_no
  								   FROM tech_in.operation
								   WHERE no = '${chlist[i]}'`) 
	  info_row.push(result[0].key_no);
  }	
	
const info_row_unique = info_row.filter((element, index) => info_row.indexOf(element) === index);	// 중복 로우 제거
	
 for(var i = 0; i <info_row_unique.length; i++) //operation에서 값을 땡겨오기 위해 사전 준비 하는 쿼리
{
	 const result_all = await asyncQuery(`SELECT COUNT(*) as cnt
										FROM tech_in.operation
										WHERE key_no = '${info_row_unique[i]}'`) //key_no를 통해 key_no의 개수를 조회하는 쿼리
	all_row_count.push(result_all[0].cnt);
}		
 for(var i = 0; i <info_row_unique.length; i++) //operation에서 값을 땡겨오기 위해 사전 준비 하는 쿼리
{
	 let result_fil = await asyncQuery(`SELECT COUNT(*) as cnt_fil
										 FROM tech_in.operation 
										 WHERE status = 12 and key_no = '${info_row_unique[i]}'`) //key_no와 status를 통해 현재 완료된 공정이 몇개인지 보는 쿼리	
	fil_row_count.push(result_fil[0].cnt_fil);
} 									
 for(var i = 0; i <info_row_unique.length; i++) {
	 var result_proc = await asyncQuery(`SELECT proc
                             FROM tech_in.process
                             WHERE key_no = '${info_row_unique[i]}'`)
	 process.push(result_proc[0].proc);	
} // 각 공정에 맞는 프로세스 가져오는 쿼리
	
for(var i = 0; i <info_row_unique.length ; i++) {
	if(all_row_count[i] == fil_row_count[i])
	{
	if (process[i].indexOf('B') !==-1){
		let row = await asyncQuery(`UPDATE tech_in.process 
								SET status = '20' 
								WHERE key_no = '${info_row_unique[i]}'`);
		}

		else if (process[i].indexOf('W') !==-1){
		let row = await asyncQuery(`UPDATE tech_in.process 
								SET status = '30' 
								WHERE key_no = '${info_row_unique[i]}'`);
		}
		else if (process[i].indexOf('P') !==-1){
		let row = await asyncQuery(`UPDATE tech_in.process 
								SET status = '40' 
								WHERE key_no = '${info_row_unique[i]}'`);
		}
		else{
			let row = await asyncQuery(`UPDATE tech_in.process 
								SET status = '50' 
								WHERE key_no = '${info_row_unique[i]}'`);
		}
	cnt = cnt +1 	
	}	
} 	// 각 공정에 맞는 프로세스 가져오는 쿼리
if(info_row_unique.length == cnt){
		res.send('all')
	}
else{
		res.send('y')
}	
	
});

// 레이저 > 레이저 다음공정 보내는 POST
app.post("/laiser_order_next", async (req, res) => {
let process = await asyncQuery(`SELECT proc
                             FROM tech_in.process
                             WHERE no = '${req.body.no}'`)

if (process[0].proc.indexOf('B') !==-1){
let row = await asyncQuery(`UPDATE tech_in.process 
                        SET status = '20' 
                        WHERE no = '${req.body.no}'`);
}

else if (process[0].proc.indexOf('W') !==-1){
let row = await asyncQuery(`UPDATE tech_in.process 
                        SET status = '30' 
                        WHERE no = '${req.body.no}'`);
}
else if (process[0].proc.indexOf('P') !==-1){
let row = await asyncQuery(`UPDATE tech_in.process 
                        SET status = '40' 
                        WHERE no = '${req.body.no}'`);
}
else{
	let row = await asyncQuery(`UPDATE tech_in.process 
                        SET status = '50' 
                        WHERE no = '${req.body.no}'`);
}
res.send('all');
});

// cad에서 도면 이미지 등록
app.post("/pdftohtml", async (req, res) => {
	
	client.convertRawDataToFile(
	fs.readFileSync(`uploads/${req.body.filename}`),
	`views/pdftohtml/${req.body.fileno}.ejs`,
	function(err, fileName) {
	if (err) return console.error("Pdfcrowd Error: " + err);
	console.log("Success: the file was created " + fileName);
	});
	res.send('');
});


// 절곡
app.get("/bending", async (req, res) => {
    let row = await asyncQuery(`SELECT a.no, 
									   a.customer, 
									   a.work_key, 
									   DATE_FORMAT(a.order_date, '%Y-%m-%d') as order_date ,
									   DATE_FORMAT(a.shipping_date, '%Y-%m-%d') as shipping_date , 
									   a.proc,
									   a.shipping,
									   a.status,
									   a.laiser_out_com,
									   a.bending_out_com,
									   a.welding_out_com,
									   a.process_out_com,
									   a.urgent_message,
									   a.work_no,
									   b.work_qty,
									   b.quality,
									   b.thickness,
									   b.materials_max,
									   b.program_name 
								 FROM tech_in.process as a
								 LEFT JOIN tech_in.operation as b 
								 ON a.work_key = b.no
								 WHERE a.proc like "%B%" and a.status <= 29 and a.status >=10
								 ORDER BY a.no DESC
								`)
    res.render("menu/bending" ,{row : row});
});


// 벤딩 > 벤딩 작업시작 POST
app.post("/bending_order_start", async (req, res) => {
let row = await asyncQuery(`UPDATE tech_in.process 
                        SET status = '21' 
                        WHERE no = '${req.body.no}'`);
res.send(row);
});

// 벤딩 > 벤딩 작업완료 POST
app.post("/bending_order_end", async (req, res) => {
let row = await asyncQuery(`UPDATE tech_in.process 
                        SET status = '22' 
                        WHERE no = '${req.body.no}'`);
res.send(row);
});

// 벤딩 > 벤딩 다음공정 보내는 POST
app.post("/bending_order_next", async (req, res) => {
let process = await asyncQuery(`SELECT proc
                             FROM tech_in.process
                             WHERE no = '${req.body.no}'`)
if (process[0].proc.indexOf('W') !==-1){
let row = await asyncQuery(`UPDATE tech_in.process 
                            SET status = '30' 
                            WHERE no = '${req.body.no}'`);
}

else if (process[0].proc.indexOf('P') !==-1){
let row = await asyncQuery(`UPDATE tech_in.process 
                            SET status = '40' 
                            WHERE no = '${req.body.no}'`);
	
}
else {
	let row = await asyncQuery(`UPDATE tech_in.process 
                            SET status = '50' 
                            WHERE no = '${req.body.no}'`);
}
res.send('y');
});

// 용접
app.get("/welding", async (req, res) => {
let row = await asyncQuery(`SELECT a.no, 
								   a.customer, 
								   a.work_key, 
								   DATE_FORMAT(a.order_date, '%Y-%m-%d') as order_date ,
								   DATE_FORMAT(a.shipping_date, '%Y-%m-%d') as shipping_date , 
								   a.proc,
								   a.shipping,
								   a.status,
								   a.laiser_out_com,
								   a.bending_out_com,
								   a.welding_out_com,
								   a.process_out_com,
								   a.urgent_message,
								   a.work_no,
								   b.work_qty,
								   b.quality,
								   b.thickness,
								   b.materials_max,
								   b.program_name 
							 FROM tech_in.process as a
							 LEFT JOIN tech_in.operation as b 
							 ON a.work_key = b.no
							 WHERE a.proc like "%W%" and a.status <= 39 and a.status >=10 
							ORDER BY a.no DESC
							   `)
res.render("menu/welding" , {row:row});
});

// 용접 > 용접 작업시작 POST
app.post("/welding_order_start", async (req, res) => {
let row = await asyncQuery(`UPDATE tech_in.process 
                        SET status = '31' 
                        WHERE no = '${req.body.no}'`);
res.send(row);
});

// 용접 > 용접 작업완료 POST
app.post("/welding_order_end", async (req, res) => {
let row = await asyncQuery(`UPDATE tech_in.process 
                        SET status = '32' 
                        WHERE no = '${req.body.no}'`);
res.send(row);
});

// 용접 > 용접 다음공정 보내는 POST
app.post("/welding_order_next", async (req, res) => {
let process = await asyncQuery(`SELECT proc
                             FROM tech_in.process
                             WHERE no = '${req.body.no}'`)

if (process[0].proc.indexOf('P') !==-1){
let row = await asyncQuery(`UPDATE tech_in.process 
                        SET status = '40' 
                        WHERE no = '${req.body.no}'`);
}

else if (process[0].proc.indexOf('P') == -1){
let row = await asyncQuery(`UPDATE tech_in.process 
                        SET status = '50' 
                        WHERE no = '${req.body.no}'`);
}
res.send('y');
});

// 후처리
app.get("/post_process", async (req, res) => {
let row = await asyncQuery(`SELECT a.no, 
								   a.customer, 
								   a.work_key, 
								   DATE_FORMAT(a.order_date, '%Y-%m-%d') as order_date ,
								   DATE_FORMAT(a.shipping_date, '%Y-%m-%d') as shipping_date , 
								   a.proc,
								   a.shipping,
								   a.status,
								   a.laiser_out_com,
								   a.bending_out_com,
								   a.welding_out_com,
								   a.process_out_com,
								   a.urgent_message,
								   a.work_no,
								   b.work_qty,
								   b.quality,
								   b.thickness,
								   b.materials_max,
								   b.program_name 
							 FROM tech_in.process as a
							 LEFT JOIN tech_in.operation as b 
							 ON a.work_key = b.no
							 WHERE a.proc like "%P%" and a.status <= 49 and a.status >=10

							 ORDER BY a.no DESC`)	
res.render("menu/post_process" , {row:row});
});

// 후처리 > 후처리 작업시작 POST
app.post("/post_process_order_start", async (req, res) => {
let row = await asyncQuery(`UPDATE tech_in.process 
                        SET status = '41' 
                        WHERE no = '${req.body.no}'`);
res.send(row);
});

// 후처리 > 후처리 작업완료 POST
app.post("/post_process_order_end", async (req, res) => {
let row = await asyncQuery(`UPDATE tech_in.process 
                        SET status = '42' 
                        WHERE no = '${req.body.no}'`);
res.send(row);
});

// 후처리 > 후처리 다음공정 보내는 POST
app.post("/post_process_order_next", async (req, res) => {
let row = await asyncQuery(`UPDATE tech_in.process 
                        SET status = '50' 
                        WHERE no = '${req.body.no}'`);
res.send('y');
});

// 납품
app.get("/shipping", async (req, res) => {
let row = await asyncQuery(`SELECT a.no, 
										   a.customer, 
										   a.work_key, 
										   DATE_FORMAT(a.order_date, '%Y-%m-%d') as order_date ,
										   DATE_FORMAT(a.shipping_date, '%Y-%m-%d') as shipping_date , 
										   a.proc,
										   a.shipping,
										   a.status,
										   a.laiser_out_com,
										   a.bending_out_com,
										   a.welding_out_com,
										   a.process_out_com,
										   a.urgent_message,
										   a.work_no,
										   b.work_qty,
										   b.quality,
										   b.thickness,
										   b.materials_max,
										   b.program_name 
							 FROM tech_in.process as a
							 LEFT JOIN tech_in.operation as b 
							 ON a.work_key = b.no
							 WHERE a.status != 100
							 ORDER BY a.no DESC`)
res.render("menu/shipping" ,{row:row});
});

app.get("/shipping_history", async (req, res) => {
let row = await asyncQuery(`SELECT a.no, 
										   a.customer, 
										   a.work_key, 
										   DATE_FORMAT(a.order_date, '%Y-%m-%d') as order_date ,
										   DATE_FORMAT(a.shipping_date, '%Y-%m-%d') as shipping_date , 
										   a.proc,
										   a.shipping,
										   a.status,
										   a.laiser_out_com,
										   a.bending_out_com,
										   a.process_out_com,
										   a.urgent_message,
										   b.work_qty,
										   b.quality,
										   b.thickness,
										   b.materials_max,
										   b.program_name 
							 FROM tech_in.process as a
							 LEFT JOIN tech_in.operation as b 
							 ON a.work_key = b.no
							 WHERE a.status = 100
							 ORDER BY a.no DESC`)

res.render("menu/shipping_history" ,{row:row});
});

// 납품 > 납품처리 하는 공정
app.post("/shipping_end", async (req, res) => {
let row = await asyncQuery(`UPDATE tech_in.process 
                            SET status = '100',
                                shipping = 'y',
								urgent_message = ''
                            WHERE no = '${req.body.no}'`);
res.send('y');
});

// 관리
app.get("/management", async (req, res) => {
 let row = await asyncQuery(`SELECT a.no, 
	   a.key_no ,
	   b.no as work_key,
                                   a.customer, 
                                   DATE_FORMAT(a.order_date, '%Y-%m-%d') as order_date,
                                   DATE_FORMAT(a.shipping_date, '%Y-%m-%d') as shipping_date, 
                                   a.proc,
                                   a.status,
                                   a.shipping,
                                   a.laiser_out_com,
                                   a.bending_out_com,
                                   a.welding_out_com,
                                   a.process_out_com,
                                   a.urgent_message,
                                   a.status,
								   a.work_no,
                                   b.file_name
                             FROM tech_in.process as a
                             left join tech_in.operation as b
                             on a.key_no = b.key_no 
                             WHERE a.status != 100
                             GROUP BY work_key 
							 ORDER BY no DESC
`)
res.render("menu/management" ,{row:row});
});

//관리 >> 외주 등록 할 때 기본 데이터 매핑

app.post("/pop_outsource_add_select", async (req, res) => {
let row = await asyncQuery(`SELECT no,
                                   customer, 
                                   work_key,
								   work_no,
                                   DATE_FORMAT(order_date, '%Y-%m-%d') as order_date,
                                   DATE_FORMAT(shipping_date, '%Y-%m-%d') as shipping_date,
                                   proc,
                                   status,
								   laiser_out_com,
								   bending_out_com,
								   welding_out_com,
								   process_out_com
                             FROM tech_in.process
                             WHERE no = '${req.body.no}'`)
res.send(row);
});

//관리 > 외주 등록 창에서 저장 버튼 눌려서 데이터 저장할때

app.post("/pop_outsource_add", async (req, res) => {
var no = req.body.no;
var laiser_out_com = req.body.laiser_out_com;
var bending_out_com = req.body.bending_out_com;
var welding_out_com = req.body.welding_out_com;
var process_out_com = req.body.process_out_com;
if(laiser_out_com==""){laiser_out_com=''}
if(bending_out_com==""){bending_out_com=''}
if(welding_out_com==""){welding_out_com=''}
if(process_out_com==""){process_out_com=''}
if(no==""){no=''}
let add = await asyncQuery(`UPDATE tech_in.process
                            SET laiser_out_com = '${laiser_out_com}',
                                bending_out_com = '${bending_out_com}',
                                welding_out_com = '${welding_out_com}',
								process_out_com = '${process_out_com}'
                            WHERE no = ${req.body.no}`)
res.send('y');
});


//관리 >> 긴급 창에서 등록 할 때 기본 데이터 매핑

app.post("/pop_urgent_select", async (req, res) => {
let row = await asyncQuery(`SELECT no, 
                                   customer, 
                                   work_key, 
								   work_no,
                                   DATE_FORMAT(order_date, '%Y-%m-%d') as order_date,
                                   DATE_FORMAT(shipping_date, '%Y-%m-%d') as shipping_date,
                                   urgent_message
                             FROM tech_in.process
                             WHERE no = '${req.body.no}'`)
res.send(row);
});


//관리 > 긴급 창에서 저장 버튼 눌려서 데이터 저장할때

app.post("/pop_urgent_add", async (req, res) => {
var urgent_message = req.body.urgent_message;
if(urgent_message==""){urgent_message=''}
let add = await asyncQuery(`UPDATE tech_in.process
                            SET urgent_message = '${urgent_message}'
                            WHERE no = ${req.body.no}`)
res.send('y');
});

//관리 > 긴급 창에서 저장 버튼 눌려서 데이터 삭제 할때
app.post("/pop_urgent_delete", async (req, res) => {
var urgent_message = req.body.urgent_message;
if(urgent_message==""){urgent_message=''}
let add = await asyncQuery(`UPDATE tech_in.process
                            SET urgent_message = ''
                            WHERE no = ${req.body.no}`)
res.send('y');
}); 

app.post("/order_first_start", async (req, res) => {	
	client.convertRawDataToFile(
	fs.readFileSync(`uploads/${req.body.filename}`),
	`views/pdftohtml/${req.body.work_key}.ejs`,
	function(err, fileName) {
	if (err) return console.error("Pdfcrowd Error: " + err);
	console.log("Success: the file was created " + fileName);
	});
	
let row_ = await asyncQuery(`SELECT status
							 FROM tech_in.process
							 WHERE no = '${req.body.no}'`);
	
	
	var status = ''
	if(row_[0].status == 1)
	{
		status = 10;
	}
	else if(row_[0].status == 2)
	{
		status = 20;
	}
	else if(row_[0].status == 3)
	{
		status = 30;
	}
	else if(row_[0].status == 4)
	{
		status = 40;
	}	
	let row = await asyncQuery(`UPDATE tech_in.process 
							SET status = '${status}'
							WHERE no = '${req.body.no}'`);				

	let row_operation = await asyncQuery(`UPDATE tech_in.operation
								SET status = '${status}'
								WHERE key_no = '${req.body.key_no}'`);

res.send(row);	
});
    
    
// CAD 기본 자료 뿌려주는 것
app.get("/cad", async (req, res) => {
	let row = await asyncQuery(`SELECT a.no ,
									   a.key_no,
									   a.file_name,
									   a.customer_name ,
									   a.program_name ,
									   a.quality ,
									   a.thickness ,
									   a.materials_max ,
									   a.work_qty,
									   DATE_FORMAT(a.UpdateTime, '%Y-%m-%d') as UpdateTime,
									   b.status 
								FROM tech_in.operation as a 
								LEFT JOIN tech_in.process as b 
								ON a.no = b.work_key
								GROUP BY a.key_no
								HAVING COUNT(b.status) = 0
								ORDER BY a.no DESC
			`)
res.render("menu/cad", {row : row});
});

//등록 버튼 눌렸을때 내용 팝업창에 불러오는 POST
app.post("/pop_cad_add_select", async (req, res) => {
var today = new Date()
var yy = today.getFullYear();
var mm = today.getMonth() +1;
var dd = today.getDate();
var va_day = ''
if(mm<10){
	if(dd <10){
		va_day = yy + '-0' + mm + '-0' + dd
	}
	
	else{
		va_day = yy + '-0' + mm + '-' + dd
	}
}
else if(mm>=10){
	if(dd <10){
		va_day = yy + '-' + mm + '-0' + dd
	}
	else{
		va_day = yy + '-' + mm + '-' + dd
	}
	
}
let row = await asyncQuery(`SELECT no, 
								   key_no,
                                   file_name, 
                                   customer_name,
                                   program_name,
								   quality,
								   thickness,
								   materials_max
                             FROM tech_in.operation
							 WHERE no = ${req.body.no}`)
res.send({row:row ,va_day:va_day});
});

//cad에서 등록으로 관리에 내용 등록하는 POST
app.post("/cad_to_management_add", async (req, res) => {
var example2 = '';
var example = req.body.shipment_date
var example1 = example.split('/')
if(req.body.shipment_date == ''){ //납기일이 비워져 있는 경우
	example2 = example2;
}
	
else { //납기일이 지정되었을때 형식 변환하는 코드
	var today = new Date()
	var yy = today.getFullYear();
	if (example1[0] < 10 && example1[0].indexOf(0) == -1) {
		example1[0] = '0' + example1[0]
	}
	if (example1[1] < 10 && example1[1].indexOf(0) == -1){
		example1[1] = '0' + example1[1]
	}
	var emxaple2 = yy+ '-' + example1[0]+ '-' +example1[1]
}
var proc = req.body.proc
var status = ''
	//있는지 없는지에 따라 status 분류하는 이프 L,B,WP 공정분류
	if(proc.indexOf('L') !== -1)
	{
		status = 1;
	}
	else if(proc.indexOf('B') !== -1)
	{
		status = 2;
	}
	else if(proc.indexOf('W') !== -1)
	{
		status = 3;
	}
	else if(proc.indexOf('P') !== -1)
	{
		status = 4;
	}
	
	// 납기일 확인하는 프로세스 
	if(req.body.order_date > emxaple2)
	{
		res.send('n')
	}
	else if(req.body.proc == '')
	{
	res.send('proc_empty')
	}
	else if(example1.length != 2 || example1[0].length >2 || example1[1].length > 2 ){
		res.send('t_n')
	}
	else{
		let add = await asyncQuery(`INSERT INTO tech_in.process
										(customer,
										 key_no,
										 work_no,
										 work_key, 
										 order_date,
										 shipping_date,
										 proc,
										 status
										 )
									VALUES (?,?,?,?,?,?,?,?)`,
										[
										  req.body.customer,
										  req.body.key_no,
										  req.body.work_no,
										  req.body.work_key,
										  req.body.order_date,
										  emxaple2,
										  req.body.proc,
										  status
										]
								  );	
		let row = await asyncQuery(`UPDATE tech_in.operation
									SET work_no = '${req.body.work_no}'
									WHERE key_no = '${req.body.key_no}'`)
		res.send('y')
	}
		
	
});

//insert 만
app.get("/pdf", async (req, res) => {
	//let dataBuffer = fs.readFileSync('uploads/0209 - 199 김민훈 SS 4T.pdf');
	let dataBuffer = fs.readFileSync('uploads/0209 - 197 권동근.pdf');
    pdf(dataBuffer).then(function(data) {
		var reg = /:|\n/gi;
		var textArr = data.text.replace(reg, "").split(" ");


		
		
		

		 for(var i = -50; i<200; i++){
			 var test = textArr[textArr.findIndex((i)=> i.indexOf("%자재사용률") != -1) + i];
			 //console.log(i+"번째 행은 : "+textArr[i])
			 console.log(i+"번째 행은 : "+test)
    	 }
		
		var test = textArr[textArr.findIndex((i)=> i.indexOf("%자재사용률") != -1) -3]
		var test1 = textArr[textArr.findIndex((i)=> i.indexOf("%자재사용률") != -1) -3]
		test1 = test.split(')');
		console.log(test1[0])

		//var customer_name_num = textArr[idx+18].split(')');
		
		
		
		
		res.render("menu/pdf_test");
    });

});



// 업로드
app.post('/upload', upload.single('userfile'), async function(req, res){
	
	 let no_max = await asyncQuery(`SELECT max(no)+1 as no from tech_in.operation o `)
	 var nomax = no_max[0].no;
	 if(no_max[0].no == undefined){nomax = 1};
	 
	let dataBuffer = fs.readFileSync(`uploads/${name}`);
    pdf(dataBuffer).then(async function(data) {
		var reg = /:|\n/gi;
		var textArr = data.text.replace(reg, "").split(" ");
		
		
		
		//let fromIndex = textArr.indexOf("%자재사용률");
		var s_work_qty = '';
		var	s_quality = '';
		var	ss_quality = '';
		var s_thickness = '';
		var materials_max_x = '';
		var materials_max_y = '';
		var materials_max_y_ = '';
		var materials_max_xy = '';
		var program_name = '';
		var customer_name = '';
		var customer_name_num = '';
		var full = '';
		var one_set = 0;
		textArr.forEach(async (el, idx) => {
			// if(el.includes('%자재사용률')) {
			// 	customer_name_num = textArr[idx+19].split(')');
			// 	customer_name = textArr[idx+16]+textArr[idx+15]+customer_name_num[0]+')';
			// }
				
			if(el.includes('%자재사용률')) {
				if(one_set == 0){
					for(var i = -4; i>-15; i--){
							if(textArr[idx+i] != ''){
								full += textArr[idx+i]
							}
						}
					one_set = 1;
				}
				console.log(full)
				if(textArr[idx-3].substr(0,1) == '('){
					customer_name_num = textArr[idx-3].split(')');	
					//customer_name = textArr[idx-4]+textArr[idx-6]+textArr[idx-7]+customer_name_num[0]+')';
					customer_name = full+customer_name_num[0]+')';
				} else {
					//customer_name = textArr[idx-4]+textArr[idx-6]+textArr[idx-7];
					customer_name = full;
				}
				
				
				s_work_qty = textArr[idx-2].split('매'); // 작업수량
				s_quality = textArr[idx+8].split('Layout');
				ss_quality = s_quality[1].split('재질');
			 	s_thickness = textArr[idx+41].split('Kg');
			 	materials_max_x = textArr[idx+20];
				materials_max_y = textArr[idx+24].split('.');
				materials_max_y_ = materials_max_y[1].substr(0,1);
				materials_max_xy = materials_max_x+" x "+materials_max_y[0]+"."+materials_max_y_;
				program_name = textArr[idx+70];	
				
				let row = await asyncQuery(`
								INSERT INTO tech_in.operation
								(
								key_no,
								file_name,
								customer_name,
								work_qty,
								quality,
								thickness,
								materials_max,
								program_name
								)
								VALUES (
								'key-${nomax}',
								'${name}',
								'${customer_name}',
								'${s_work_qty[1]}매',
								'${ss_quality[0]}',
								'${s_thickness[1]}T',
								'${materials_max_xy}',
								'${program_name}'
								)
								`);
				
				
			}
			
			// if(el.includes('명')) {
			// 	customer_name = textArr[idx+15];	
			// }
			
		})
		
		
		
	
		
    return res.send(
      `<script> alert('등록이 완료되었습니다.'); location.href = '/cad';</script>`
    );
    });
	
	
	

	
	
});

//캐드에서 도면 눌렸을때 번호가 들어오면 렌더링 해주는 것
app.get('/:no', (req, res) => {
  const no = req.params.no; // GET 요청에서 숫자 데이터를 가져옴
  res.render(`pdftohtml/${no}`); // 해당 숫자에 대한 뷰를 렌더링함
});

app.get('/123456', (req, res) => {
  const no = req.params.no; // GET 요청에서 숫자 데이터를 가져옴
  res.render(`pdftohtml/${no}`); // 해당 숫자에 대한 뷰를 렌더링함
});


app.get("/laiser_detail/:no", async (req, res) => {
	var page_key_no = req.params.no;
	var row_operation = [];
	var laiser_out_com = '';
	var search_material_value ='';
	
	let row = await asyncQuery(`SELECT a.no, 
									   a.customer, 
									   a.work_key, 
									   DATE_FORMAT(a.order_date, '%Y-%m-%d') as order_date ,
									   DATE_FORMAT(a.shipping_date, '%Y-%m-%d') as shipping_date , 
									   a.proc,
									   a.shipping,
									   a.status,
									   a.laiser_out_com,
									   a.bending_out_com,
									   a.welding_out_com,
									   a.process_out_com,
									   a.urgent_message,
									   a.work_no,
									   a.key_no,
									   b.work_qty,
									   b.quality,
									   b.thickness,
									   b.materials_max,
									   b.program_name,
									   b.file_name
								 FROM tech_in.process as a
								 LEFT JOIN tech_in.operation as b 
								 ON a.work_key = b.no
								 WHERE a.proc like "%L%" and a.status <= 19 and a.status >=10
								 ORDER BY a.no DESC
       `)
	let check_row = await asyncQuery(`SELECT a.no, 
									   a.customer, 
									   a.work_key, 
									   DATE_FORMAT(a.order_date, '%Y-%m-%d') as order_date ,
									   DATE_FORMAT(a.shipping_date, '%Y-%m-%d') as shipping_date , 
									   a.proc,
									   a.shipping,
									   a.status,
									   a.laiser_out_com,
									   a.bending_out_com,
									   a.welding_out_com,
									   a.process_out_com,
									   a.urgent_message,
									   a.work_no,
									   a.key_no,
									   b.work_qty,
									   b.quality,
									   b.thickness,
									   b.materials_max,
									   b.program_name,
									   b.file_name
								 FROM tech_in.process as a
								 LEFT JOIN tech_in.operation as b 
								 ON a.work_key = b.no
								 WHERE a.proc like "%L%" and a.status <= 19 and a.status >=10 and a.key_no = '${req.params.no}'
								 ORDER BY a.no DESC
       `)
		
	if(check_row != ''){
		laiser_out_com = check_row[0].laiser_out_com;
	}
	
		//laiser_out_com = check_row[0].laiser_out_com;
	if(req.params.no == 1){
		row_operation = await asyncQuery(`SELECT a.no,
												 a.work_no,
												 a.key_no,
												 a.file_name,
												 a.quality,
												 a.customer_name,
												 a.work_qty,
												 a.thickness,
												 a.materials_max,
												 a.status,
												 DATE_FORMAT(b.shipping_date, '%Y-%m-%d') as shipping_date,
												 b.laiser_out_com,
												 b.urgent_message
										 FROM tech_in.operation as a
										 LEFT join tech_in.process as b
										 ON a.key_no = b.key_no 
										 WHERE a.status <= 11 and a.status >=10 and b.laiser_out_com = ''
										 ORDER BY work_no DESC
       `)	
	}
	else{
		row_operation = await asyncQuery(`SELECT a.no,
												 a.work_no,
												 a.key_no,
												 a.file_name,
												 a.quality,
												 a.customer_name,
												 a.work_qty,
												 a.thickness,
												 a.materials_max,
												 a.status,
												 DATE_FORMAT(b.shipping_date, '%Y-%m-%d') as shipping_date,
												 b.laiser_out_com,
												 b.urgent_message
										 FROM tech_in.operation as a
										 LEFT join tech_in.process as b
										 ON a.key_no = b.key_no 
										 WHERE a.status <= 12 and a.status >=10 and a.key_no = '${req.params.no}' 
										 ORDER BY work_no DESC
       `)
		
	}

	//여기서 b.laiser_out_com이 있다면 1을 넘기던 해서 그 값이 1이면 버튼 안나오고 1이 아니면 버튼 나오게
    res.render("menu/laiser_detail", {row:row ,
									  row_operation:row_operation ,
									  page_key_no : page_key_no ,
									  check_row: check_row,
									  laiser_out_com:laiser_out_com,
									  search_material_value:search_material_value,
									 });
});

app.get("/laiser_detail/1/:no", async (req, res) => {
	var page_key_no = 1;
    var search_material_value = req.params.no;
	var row_operation = [];
	var laiser_out_com = '';
	
	let row = await asyncQuery(`SELECT a.no, 
									   a.customer, 
									   a.work_key, 
									   DATE_FORMAT(a.order_date, '%Y-%m-%d') as order_date ,
									   DATE_FORMAT(a.shipping_date, '%Y-%m-%d') as shipping_date , 
									   a.proc,
									   a.shipping,
									   a.status,
									   a.laiser_out_com,
									   a.bending_out_com,
									   a.welding_out_com,
									   a.process_out_com,
									   a.urgent_message,
									   a.work_no,
									   a.key_no,
									   b.work_qty,
									   b.quality,
									   b.thickness,
									   b.materials_max,
									   b.program_name,
									   b.file_name
								 FROM tech_in.process as a
								 LEFT JOIN tech_in.operation as b 
								 ON a.work_key = b.no
								 WHERE a.proc like "%L%" and a.status <= 19 and a.status >=10
								 ORDER BY a.no DESC
       `)
	let check_row = await asyncQuery(`SELECT a.no, 
									   a.customer, 
									   a.work_key, 
									   DATE_FORMAT(a.order_date, '%Y-%m-%d') as order_date ,
									   DATE_FORMAT(a.shipping_date, '%Y-%m-%d') as shipping_date , 
									   a.proc,
									   a.shipping,
									   a.status,
									   a.laiser_out_com,
									   a.bending_out_com,
									   a.welding_out_com,
									   a.process_out_com,
									   a.urgent_message,
									   a.work_no,
									   a.key_no,
									   b.work_qty,
									   b.quality,
									   b.thickness,
									   b.materials_max,
									   b.program_name,
									   b.file_name
								 FROM tech_in.process as a
								 LEFT JOIN tech_in.operation as b 
								 ON a.work_key = b.no
								 WHERE a.proc like "%L%" 
								   AND a.status <= 19 
								   AND a.status >=10 
								   AND a.key_no = '${req.params.no}'
								 ORDER BY a.no DESC
       `)
		
	if(check_row != ''){
		laiser_out_com = check_row[0].laiser_out_com;
	}
	
		row_operation = await asyncQuery(`SELECT a.no,
											     a.work_no,
											     a.key_no,
											     a.file_name,
											     a.quality,
											     a.customer_name,
											     a.work_qty,
											     a.thickness,
											     a.materials_max,
											     SUBSTRING_INDEX(a.materials_max, 'x', 1) AS xmax,
											     a.status,
											     DATE_FORMAT(b.shipping_date, '%Y-%m-%d') AS shipping_date,
											     b.laiser_out_com,
											     b.urgent_message
											FROM tech_in.operation AS a
											LEFT JOIN tech_in.process AS b ON a.key_no = b.key_no 
											WHERE a.status <= 11 
											  AND a.status >= 10 
											  AND b.laiser_out_com = '' 
											  AND CAST(SUBSTRING_INDEX(a.materials_max, 'x', 1) AS UNSIGNED) <= '${req.params.no}'
											ORDER BY a.thickness DESC , a.materials_max DESC;
       `)	

	//여기서 b.laiser_out_com이 있다면 1을 넘기던 해서 그 값이 1이면 버튼 안나오고 1이 아니면 버튼 나오게
    res.render("menu/laiser_detail", {row:row ,
									  row_operation:row_operation ,
									  page_key_no : page_key_no ,
									  check_row: check_row,
									  laiser_out_com:laiser_out_com,
									  search_material_value:search_material_value
									 });
});

