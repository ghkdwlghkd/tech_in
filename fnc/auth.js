// npm install --save passport passport-local cookie-parser express-session connect-flash bcrypt-nodejs
const express = require("express");
const router = express.Router();
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash");
const bcrypt = require("bcrypt-nodejs");

const mysql = require("mysql");
const {
  setConnect,
  getKeysAndValues,
  getQueryModifyString,
  getQueryTargetString,
  getHashPassword,
} = require("./common");
const db = setConnect(mysql);
const Mybatis = require("./CommonMybatis");
const target = {
  // id:"tttt"
};

let state = 0;

const tableName = "user_info";
const xmlName = "auth";
const mybatis = new Mybatis();
mybatis.setMybatisCreateMapper("./fnc/mapper/auth-sql.xml");

router.use(express.json());
router.use(express.urlencoded({ extended: false }));

//  passport setting
exports.setPassport = (app) => {
  app.use(cookieParser("keyboard cat"));
  app.use(
    session({
      secret: "keyboard cat",
      resave: true,
      saveUninitialized: false,
    })
  );
  app.use(flash());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    const target = {
      id: id,
    };

    const params = {
      tableName: tableName,
      target: getQueryTargetString(target),
    };

    mybatis.setMybatisStatement({ xmlName, queryId: "getItem", params });
    const query = mybatis.getMybatisStatement();

    db.query(query, (err, rows) => {
      if (err) {
        console.log(err);
        return;
      }
      done(null, JSON.parse(JSON.stringify(rows[0])));
    });
  });

  passport.use(
    new LocalStrategy(
      {
        usernameField: "id",
        passwordField: "pass",
      },
      (username, password, done) => {
        const target = {
          id: username,
        };

        const params = {
          tableName: tableName,
          target: getQueryTargetString(target),
        };

        mybatis.setMybatisStatement({ xmlName, queryId: "getItem", params });
        const query = mybatis.getMybatisStatement();

        db.query(query, (err, rows) => {
          if (err) {
            console.log(err);
            return;
          }

          if (rows.length == 0) {
            state = 0;
            return done(null, false, { message: "존재하지 않는 계정입니다." });
          }

          if (username != rows[0].id) {
            state = 2;
            return done(null, false, {
              message: "아이디 혹은 비밀번호가 다릅니다.",
            });
          }

          if (bcrypt.compareSync(password, rows[0].pass)) {
            state = 1;
            return done(null, rows[0]);
          } else {
            state = 2;
            return done(null, false, {
              message: "아이디 혹은 비밀번호가 다릅니다.",
            });
          }
        });
      }
    )
  );
};

exports.getPassport = () => {
  return passport;
};

//  state : 0 = 아이디 없음, 1 = 성공, 2 = 아이디 or 패스워드 틀림
exports.getState = () => {
  return state;
};

//	유저 정보 변경
exports.modify = () => {};
