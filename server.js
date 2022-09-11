const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const dbName = 'practiceDB';
const newTable = 'customer';
const md5 = require('md5');
const cookieParser = require("cookie-parser");
const sessions = require('express-session');
var request = require('request');
var fs = require('fs');
const csvtojson = require('csvtojson');
var moment = require('moment');
const multer = require("multer");
const nodemailer = require('nodemailer');
var limit = 10;

const fileStorageEngine = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
})
const upload = multer({ storage: fileStorageEngine });

// Authenticate unique key in the headers and without headers show the page error.

const db = mysql.createConnection({
    host: '',
    user: '',
    password: '',
    database: dbName
});

// Creating transporter
var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: '',
        pass: ''
    }
})

// Connect
db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Mysql connected...');
});

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json())
app.use(express.static("public"));

// a variable to save a session
var session;
let secret = ``;
const oneDay = 1000 * 60 * 60 * 24;

//session middleware
app.use(sessions({
    secret: secret,
    saveUninitialized: true,
    cookie: { maxAge: oneDay },
    resave: false
}));

// Home route
app.get('/', isAuthenticated2, (req, res) => {
    res.render('index');
});

app.get('/fileupload', isAuthenticated2, (req, res) => {
    res.render('fileupload');
});

app.post("/uploadfiles", upload.single("file"), (req, res) => {
    // console.log(req.body);
    // console.log(req.file);
    res.redirect("/");
});

app.get('/bulk', isAuthenticated2, (req, res) => {
    // let results = [];
    // let JSONData = generatePayload();
    // CSV file parser
    session = req.session;
    csvtojson().fromFile(__dirname + '/uploads/' + 'data.csv').then((JSONData) => {
        // res.send(JSONData);
        let body = {
            "headers": {
                "content-type": "application/json",
                "ci-api-key": session.uniquekey,
                "username": session.username,
                "password": session.password
            },
            "url": `http://${req.headers.host}/api/addinvoice`,
            "body": JSON.stringify(JSONData)
        };
        // console.log(body, "body");
        request.post(body, (body) => {
            res.redirect("/download");
        });
    });
});
app.get('/login', (req, res) => {
    res.render('login');
});
app.get('/signup', (req, res) => {
    let sql = `SELECT email FROM user`;
    db.query(sql, (err, result) => {
        if (err) throw err;
        res.render('signup');
    })
});
app.get('/addinvoice', isAuthenticated, (req, res) => {
    res.render('invoice');
});
app.get('/updateinvoice/:id', isAuthenticated, async (req, res) => {
    let sql = `SELECT * FROM invoices WHERE invoiceNum = ${req.params.id}`;
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.render("updateinvoice", { fulData: result });
    })
})

app.get('/download', function (req, res) {
    res.download(__dirname + '/public/results/report.json', function (err) {
        if (err) {
            console.log(err);
        }
    })
})

// Create table
app.get('/api/createtable', (req, res) => {
    // let sql = `CREATE TABLE logs(uniqueID int AUTO_INCREMENT ,reqIncoming VARCHAR(255), reqOutgoing VARCHAR(255), reqBy VARCHAR(255), reqBody longtext, reqResponse longtext, incomingIp VARCHAR(255), headers TEXT,  status int, createdBy VARCHAR(255), createdOn VARCHAR(255), modifiedOn VARCHAR(255), modifiedBy VARCHAR(255), PRIMARY KEY (uniqueID))`;
    // let sql = `CREATE TABLE invoices(uniqueID int AUTO_INCREMENT, invoiceNum VARCHAR(255), invoiceStartDate VARCHAR(255), invoiceEndDate VARCHAR(255), invoiceAmount int, discountAmount int, disbursedTotal int, disbursedDate VARCHAR(255), goodAcceptanceDate VARCHAR(255), repaymentDate VARCHAR(255), status int, createdBy VARCHAR(255), createdOn VARCHAR(255), modifiedOn VARCHAR(255), modifiedBy VARCHAR(255), buyerID VARCHAR(100), sellerID VARCHAR(100), PRIMARY KEY(uniqueID))`;
    // let sql = `CREATE TABLE transactions(uniqueID int AUTO_INCREMENT, invoiceNum VARCHAR(255), invoiceStartDate VARCHAR(255), invoiceEndDate VARCHAR(255), invoiceAmount int, discountAmount int, disbursedTotal int, disbursedDate VARCHAR(255), goodAcceptanceDate VARCHAR(255), repaymentDate VARCHAR(255), status int, createdBy VARCHAR(255), createdOn VARCHAR(255), modifiedOn VARCHAR(255), modifiedBy VARCHAR(255), buyerID VARCHAR(100), sellerID VARCHAR(100), PRIMARY KEY(uniqueID))`;
    let sql = `CREATE TABLE user(userID int AUTO_INCREMENT, username VARCHAR(255), email VARCHAR(255), password VARCHAR(255), uniquekey VARCHAR(200), PRIMARY KEY (userID)) `;
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send(`Log Table created....`)
    })
});

app.get('/api/deletetable', (req, res) => {
    let sql = `DROP TABLE invoices`;
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send(`Deleted table`)
    })
})

// Function to create unique key
function create_UUID() {
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx4xxxyxxx'.replace(/[xy]/g, function (c) {
        var r = (dt + Math.random() * 16) % 16 | 0;
        dt = Math.floor(dt / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}

app.post('/api/createuser', (req, res) => {
    let uniqueKEY = create_UUID();
    let post = {
        username: req.body.username,
        email: req.body.email,
        password: md5(req.body.password),
        uniquekey: uniqueKEY
    }
    // console.log(post);
    let sql = `INSERT INTO user SET ?`;
    db.query(sql, post, (err, result) => {
        if (err) throw err;
        console.log(result);
        // res.send([{api_key: post["uniquekey"]}]);
        // mailing the link
        var mailOptions = {
            from: 'testharsh141@gmail.com',
            to: req.body.email,
            subject: 'Your Unique Key',
            text: uniqueKEY
        }

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
            }
            else {
                // console.log('Email sent: ' + info.response);
                res.redirect('/login')
            }
        })
    })
})

// Login user
app.post('/api/loginuser', (req, res) => {

    // console.log(req.body);
    let sql = `SELECT * FROM user WHERE username = "${req.body.username}" AND password = "${md5(req.body.password)}" AND uniquekey = "${req.body.uniquekey}"`;
    db.query(sql, (err, result) => {
        if (err) throw err;
        if (result.length) {
            session = req.session;
            // console.log(result[0]["username"]);
            session.username = result[0]["username"];
            session.password = req.body.password;
            session.uniquekey = result[0]["uniquekey"];
            res.redirect('/');
        }
    })
})

// Get all Invoice
app.get('/api/allinvoices/:page', isAuthenticated2, (req, res) => {
    let sqlcount = `SELECT COUNT(*) AS count FROM invoices`;
    db.query(sqlcount, (err, count) => {
        if (err) throw err;
        let pagesNo = Math.ceil(count[0]['count'] / limit);
        let offset = (req.params.page - 1) * limit;
        let sql = `SELECT * FROM invoices LIMIT ${limit} OFFSET ${offset}`;
        db.query(sql, (err, result) => {
            if (err) throw err;
            const ans = {};
            (parseInt(req.params.page) === 1) ? ans.p = 0 : ans.p = parseInt(req.params.page) - 1;
            (parseInt(req.params.page) === pagesNo) ? ans.n = 0 : ans.n = parseInt(req.params.page) + 1;
            res.render("allinvoices", { fulData: result, page: req.params.page, prev: ans.p, next: ans.n });
        })
    })

})

function create_uniqueRef() {
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxxxxxx4xxx'.replace(/[xy]/g, function (c) {
        var r = (dt + Math.random() * 16) % 16 | 0;
        dt = Math.floor(dt / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}

function isLeapYear(year) {
    return ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0);
}

function generatePayload() {
    const data = []
    for (let i = 1; i <= 350; i++) {
        data.push(
            {
                "invoiceNum": `${i}`,
                "invoiceStartDate": "12-Jul-2022",
                "invoiceEndDate": "20-Jul-2022",
                "invoiceAmount": 1000000,
                "discountAmount": 1000000,
                "disbursedTotal": 1000000,
                "disbursedDate": "20-Jul-2022",
                "repaymentDate": "20-Jul-2022",
                "buyerID": "abc123",
                "sellerID": "1234",
                "status": 1
            }
        );
    }
    fs.writeFile('./data.csv', JSON.stringify(data), err => {
        if (err) {
            console.error(err)
            return
        }
        //file written successfully
    })
    return JSON.stringify(data);
}

// Insert Invoice
app.post('/api/addinvoice', isAuthenticated, async (req, res) => {
    const format1 = "YYYY-MM-DD HH:mm:ss";
    const format2 = "YYYY-MM-DD";
    let startTime = new Date();
    let insertResponse = [];
    let response = {
        status: 400,
        turnaroundTime: 0,
        successKey: [],
        error: []
    }
    let month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    let days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let data = req.body;
    data.forEach((invoice, index, array) => {
        let errorMessage = [];
        // Sanatizing variables
        invoice["invoiceAmount"] = parseInt(invoice["invoiceAmount"]);
        invoice["status"] = parseInt(invoice["status"]);
        invoice["invoiceNum"] = invoice["invoiceNum"].toString().replace(/[^a-zA-Z0-9]/g, '');
        invoice["invoiceStartDate"] = invoice["invoiceStartDate"].replace(/[^a-zA-Z0-9-]/g, '');
        invoice["invoiceEndDate"] = invoice["invoiceEndDate"].replace(/[^a-zA-Z0-9-]/g, '');
        // invoice["invoiceAmount"] = parseInt(invoice["invoiceAmount"].toString().replace(/[^0-9-]/g, ''));
        // invoice["discountAmount"] = parseInt(invoice["discountAmount"].toString().replace(/[^0-9-]/g, ''));
        // invoice["disbursedTotal"] = parseInt(invoice["disbursedTotal"].toString().replace(/[^0-9-]/g, ''));
        invoice["disbursedDate"] = invoice["disbursedDate"].replace(/[^a-zA-Z0-9-]/g, '');
        invoice["repaymentDate"] = invoice["repaymentDate"].replace(/[^a-zA-Z0-9-]/g, '');

        if (invoice["invoiceNum"].toString().length > 200 || invoice["invoiceNum"].toString().length <= 0) {
            // response["error"].push({ invoiceNumber: invoice["invoiceNum"], error_message: `Invoice number length should be between 1 - 200 for invoice number ${invoice["invoiceNum"]}` })
            errorMessage.push('Invoice number length should be between 1 - 200')
            // return;
        }
        if (typeof invoice["invoiceAmount"] != 'number') {
            // response["error"].push({ invoiceNumber: invoice["invoiceNum"], error_message: `Invalid amount for invoice number ${invoice["invoiceNum"]}` })
            errorMessage.push("Invalid amount type, should be a number");
            // return;
        }
        if (invoice["invoiceAmount"] <= 0) {
            // response["error"].push({ invoiceNumber: invoice["invoiceNum"], error_message: `Amount should be greater than 0 for invoice number ${invoice["invoiceNum"]}` })
            errorMessage.push("Amount should be greater than 0");
            // return;
        }
        if (invoice["invoiceAmount"] >= 1e+10) {
            // response["error"].push({ invoiceNumber: invoice["invoiceNum"], error_message: `Amount should not be more than 10 digits for invoice number ${invoice["invoiceNum"]}` })
            errorMessage.push("Amount should not be more than 10 digits");
            // return;
        }

        // Dates format validity
        let checkDates = ["invoiceStartDate", "invoiceEndDate", "disbursedDate", "repaymentDate"];
        checkDates.forEach((checkDatesFormat) => {
            // console.log(checkDatesFormat);
            let dateString = invoice[checkDatesFormat].split('-').map((p) => p);
            if (dateString.length != 3) {
                errorMessage.push('Invalide date syntax')
            }
            if (month.indexOf(dateString[1].toLowerCase()) == -1) {
                // response["error"].push({ invoiceNumber: invoice["invoiceNum"], error_message: `Invalid date for invoice number ${invoice["invoiceNum"]}` })
                errorMessage.push('Invalid Month');
                // return false;
            }
            if (isLeapYear(parseInt(dateString[2]))) {
                days[1] = 29;
            } else {
                days[1] = 28;
            }
            if (days[month.indexOf(dateString[1].toLowerCase())] < parseInt(dateString[0]) || parseInt(dateString[0]) < 1) {
                // response["error"].push({ invoiceNumber: invoice["invoiceNum"], error_message: `Invalid date for invoice number ${invoice["invoiceNum"]}` })
                errorMessage.push('Invalid Date');
                // return false;
            }
            // Invoice start date validity
            if (checkDatesFormat == "invoiceStartDate") {
                let date_1 = new Date(`${month.indexOf(dateString[1].toLowerCase()) + 1}/${dateString[0]}/${dateString[2]}`);
                let date_2 = new Date();

                const days = (date_1, date_2) => {
                    let difference = date_2.getTime() - date_1.getTime();
                    let TotalDays = Math.ceil(difference / (1000 * 3600 * 24));
                    return TotalDays;
                }
                if (days(date_1, date_2) < 0) {
                    // response["error"].push({ invoiceNumber: invoice["invoiceNum"], error_message: `Invalid invoice start date for invoice number ${invoice["invoiceNum"]}` })
                    errorMessage.push('Invalid invoice start date, cannot be a future date');
                    // return false;
                }
                if (days(date_1, date_2) > 120) {
                    errorMessage.push('Invalid invoice start date, cannot be older than 120 days');
                }
            }
        })
        // Dates format validity ends
        // console.log(errorMessage.length);
        // console.log(errorMessage);
        let dataQuery = async () => {
            let sql = `SELECT * FROM invoices WHERE invoiceNum = '${invoice["invoiceNum"]}' AND buyerID = '${invoice["buyerID"]}' AND sellerID = '${invoice["sellerID"]}'`;
            const records = await new Promise((resolve, reject) => {
                db.query(sql, (err, result) => {
                    if (err) throw err;
                    resolve(result);
                })
            })
            return records.length;
        }
        dataQuery().then((noOfRecords) => {
            if (noOfRecords != 0) {
                // console.log(ans);
                errorMessage.push('Duplicate Invoice')
            }

            if (errorMessage.length) {
                response["error"].push({ invoiceNumber: invoice["invoiceNum"], error_message: errorMessage })
            } else {
                // Yaha changes krne hai
                let date = new Date();
                let createdTime = moment(date).format(format1);
                // let dateTemp = invoice["invoiceStartDate"].split('-').map((p) => p);
                date = new Date(invoice['invoiceStartDate']);
                let invoiceStartDate = moment(date).format(format2);
                // dateTemp = invoice["invoiceEndDate"].split('-').map((p) => p);
                date = new Date(invoice["invoiceEndDate"]);
                let invoiceEndDate = moment(date).format(format2);
                // dateTemp = invoice["disbursedDate"].split('-').map((p) => p);
                date = new Date(invoice["disbursedDate"]);
                let disbursedDate = moment(date).format(format2);
                // dateTemp = invoice["repaymentDate"].split('-').map((p) => p);
                date = new Date(invoice["repaymentDate"]);
                let repaymentDate = moment(date).format(format2);
                // let createdTime = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
                insertResponse.push([invoice["invoiceNum"], invoiceStartDate, invoiceEndDate, invoice["invoiceAmount"], invoice["discountAmount"], invoice["disbursedTotal"], disbursedDate, repaymentDate, invoice["buyerID"], invoice["sellerID"], invoice['status'], req.userID, createdTime]);
                response["successKey"].push({ invoiceNumber: invoice["invoiceNum"], uniqueRef_number: create_uniqueRef() });
            }
            if (index === array.length - 1) {
                if (insertResponse.length) {
                    let sql2 = `INSERT INTO invoices (invoiceNum, invoiceStartDate, invoiceEndDate, invoiceAmount, discountAmount, disbursedTotal, disbursedDate, repaymentDate, buyerID, sellerID, status, createdBy, createdOn) VALUES ?`;
                    db.query(sql2, [insertResponse], (err, result) => {
                        if (err) {
                            throw err;
                        }
                        console.log(result.affectedRows);
                    })
                    sql2 = `INSERT INTO transactions (invoiceNum, invoiceStartDate, invoiceEndDate, invoiceAmount, discountAmount, disbursedTotal, disbursedDate, repaymentDate, buyerID, sellerID, status, createdBy, createdOn) VALUES ?`;
                    db.query(sql2, [insertResponse], (err, result) => {
                        if (err) {
                            throw err;
                        }
                        // console.log(result.affectedRows);
                    })
                }
                let endTime = new Date();
                response["turnaroundTime"] = (endTime.getTime() - startTime.getTime()) + 'ms';
                response["status"] = 200;
                let date = startTime;
                let requestIncoming = moment(date).format(format1);
                date = endTime;
                let requestOutgoing = moment(date).format(format1);

                let sql3 = `INSERT INTO logs(reqIncoming, reqOutgoing, reqBy, reqBody, reqResponse, incomingIp, headers, createdBy, createdOn, status) VALUES ("${requestIncoming}", "${requestOutgoing}", "${req.userID}", '${JSON.stringify(data)}', '${JSON.stringify(response)}', "${req.ip}", '${JSON.stringify(req.headers)}', "${req.userID}", "${requestOutgoing}", 1)`;
                db.query(sql3, (err, result) => {
                    if (err) {
                        throw err;
                    }
                })
                fs.writeFile("public/results/report.json", JSON.stringify(response), function (err) {
                    if (err) {
                        console.log(err);
                    }
                });
                res.send(response);
                // return response;
            }
        });
    })

});
// app.post('/api/addinvoice', isAuthenticated, async (req, res) => {
//     let sql = `SELECT userID FROM user WHERE uniquekey = "${req.body.uniquekey}"`;
//     db.query(sql, (err, result) => {
//         if (err) throw err;
//         console.log(result);
//         session = req.session;
//         let post = {
//             invoiceNum: req.body.invoicenum,
//             invoiceStartDate: req.body.invoicestartdate,
//             invoiceEndDate: req.body.invoiceenddate,
//             invoiceAmount: req.body.invoiceamount,
//             discountAmount: req.body.discountamount,
//             disbursedTotal: req.body.disbursedtotal,
//             disbursedDate: req.body.disburseddate,
//             repaymentDate: req.body.repaymentdate,
//             createdBy: result[0].userID,
//             createdOn: new Date().toString().split('GMT')[0]
//         }
//         if (result[0].userID == session.userid) {
//             sql = `INSERT INTO invoices SET ?`;
//             db.query(sql, post, (err, result) => {
//                 if (err) throw err;
//                 console.log(sql, result);
//                 res.redirect("/api/allinvoices");
//             })
//         } else {
//             res.send("Unauthorized");
//         }
//     })
// });

// Update Invoice
app.post('/api/updateinvoice/:id', isAuthenticated, (req, res) => {
    let sql = `SELECT userID FROM user WHERE uniquekey = "${req.body.uniquekey}"`;
    db.query(sql, (err, result) => {
        if (err) throw err;
        session = req.session;

        if (result[0].userID == session.userid) {
            sql = `UPDATE invoices SET status = ${req.body.status}, invoiceStartDate = "${req.body.invoicestartdate}", invoiceEndDate = "${req.body.invoiceenddate}", invoiceAmount = ${req.body.status}, discountAmount = ${req.body.discountamount}, disbursedTotal = ${req.body.disbursedtotal}, disbursedDate = "${req.body.disburseddate}", goodAcceptanceDate = "${req.body.goodacceptancedate}", repaymentDate = "${req.body.repaymentdate}", modifiedBy = ${result[0].userID}, modifiedOn = "${new Date().toString().split('GMT')[0]}" WHERE invoiceNum = ${req.params.id}`;
            db.query(sql, (err, result) => {
                if (err) throw err;
                console.log(result);
                res.redirect('/api/allinvoices');
            })
        } else {
            res.send("Unauthorized");
        }
    })
});

// Delete invoice
app.get('/api/deleteinvoice/:id/:page', isAuthenticated2, (req, res) => {
    let sql = `DELETE FROM invoices WHERE invoiceNum = ${req.params.id}`;
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.redirect(`/api/allinvoices/${req.params.page}`)
    })
})

// Logout
app.get('/api/logout', isAuthenticated2, (req, res) => {
    req.session.destroy();
    res.redirect("/")
})

app.get('/api/changestatus', (req, res) => {
    let sql = "UPDATE invoices SET status = 7 WHERE status = 1";
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send('Updated status of invoices table invoices from maker process to disbursed');
    })
})

app.get('/api/cron1', (req, res) => {
    let sql = "UPDATE transactions SET status = 3 WHERE status = 1";
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send('Updated status of transaction table invoices from 1 to 3');
    })
})

app.get('/api/cron2', (req, res) => {
    let sql = `UPDATE transactions SET status = 5 WHERE status = 3`;
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send('Updated status of transaction table invoices from 3 to 5');
    })
})

function isAuthenticated(req, res, next) {
    // Check if ci-api-key is there or not
    // Put everything inside the query
    // Encrypted password
    let sql = `SELECT userID FROM user WHERE uniquekey = "${req.headers["ci-api-key"]}" AND username = "${req.headers["username"]}" AND password = "${md5(req.headers["password"])}"`;
    db.query(sql, (err, result) => {
        if (err) throw err;
        // console.log();
        req.userID = result[0]["userID"];
        if (result.length) {
            next();
        } else {
            res.send("Invalid Credintials");
        }
    })
};

function isAuthenticated2(req, res, next) {
    session = req.session
    if (session.username)
        next();
    else
        res.redirect("/login")
};

app.listen(3000, () => {
    console.log('http://localhost:3000');
})

