let CommonMybatis = function(){

    this.mybatisMapper = require('mybatis-mapper');

    this.mybatisConfig = {
        xmlName : ""
        ,queryId : ""
        ,params : {}
        ,format : {language: 'sql', indent: '  '}
    }

    this.setMybatisCreateMapper = (xml)=>{
        this.mybatisMapper.createMapper([xml]);
    }

    this.setMybatisStatement = (config)=>{
        this.mybatisConfig = {...config};
    }

    this.getMybatisStatement = ()=>{
        return this.mybatisMapper.getStatement(this.mybatisConfig.xmlName, this.mybatisConfig.queryId, this.mybatisConfig.params, this.mybatisConfig.format)
	}
}

module.exports = CommonMybatis;