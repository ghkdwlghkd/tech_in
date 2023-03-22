const bcrypt = require('bcrypt-nodejs');

const infomation = {
    host:"citeksystem.synology.me",
    user:"root",
    password:"Citek8098!",
    database:"wmes_hg",
    port:3307
}

exports.setConnect = (mysql)=>{    
    return mysql.createConnection(infomation);
}

exports.getQueryTargetString = (target)=>{
    const sepArr = this.getKeysAndValues(target);
    const sumArr = sepArr.keys.map((item, index)=> `${item} = ${sepArr.values[index]}`);
    return sumArr.join(" and ");
}

//  UPDATE SET 문의 내용으로 들어갈 필드와 값을 만들어주는 기능
exports.getQueryModifyString = (target)=>{
    const sepArr = this.getKeysAndValues(target);
    const sumArr = sepArr.keys.map((item, index)=> `${item} = ${sepArr.values[index]}`);
    return sumArr.join(",");
}

//  json을 key와 value 별로 나눠주는 기능 
exports.getKeysAndValues = (json)=>{
    var keyArr = [];
    var valArr = [];
    var obj = Object.keys(json);
    obj.forEach((item, index)=>{
        keyArr.push(`${String(item)}`);
        valArr.push(`'${json[item]}'`);
    });

    return {keys:keyArr, values:valArr};
}

//  암호화 된 비밀번호 생성 기능
exports.getHashPassword = (password) =>{
    return bcrypt.hashSync(password);
}