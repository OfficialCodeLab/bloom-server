/*======================================================================*\
    Bloom Node Server
    Author: CodeLab (http://www.codelab.io)
    Version: BETA 1.0.0
\*======================================================================*/
"use strict";
console.log("======================================================================\n" +
    "Bloom Node Server\n" +
    "Author: CodeLab (http://www.codelab.io)\n" +
    "Version: BETA 1.0.0\n" +
    "======================================================================\n")
/*======================================================================*\
    Require Section
\*======================================================================*/
var path = require('path');
var EmailTemplates = require('swig-email-templates');
var nodemailer = require('nodemailer');
var admin = require("firebase-admin");
var rek = require('rekuire');
var express = require("express");
var moment = require('moment');
// var schedule = require('node-schedule');
var templates = new EmailTemplates({
  root: path.join(__dirname, "templates")
});


/*======================================================================*\
    Initialize Section
\*======================================================================*/

// Set up Express.js app
var app = express();

var mailLogin = rek("credentials/bloom-gmail.json");

// Set up nodemailer transporter with an account
var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: mailLogin.email,
        pass: mailLogin.pass
    }
});


/*======================================================================*\
    Set up firebase and database reference as variables
\*======================================================================*/

var serviceAccount = rek("credentials/pear-server-d23d792fe506.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://pear-server.firebaseio.com"
});

// As an admin, the app has access to read and write all data, regardless of Security Rules
var db = admin.database();
var ref = db.ref("restricted_access/secret_document");


/*======================================================================*\
    Once ref has been initialized and has a value, run this code once
\*======================================================================*/

ref.once("value", function(snapshot) {
  console.log("Connected to Firebase successfully!");
});


/*======================================================================*\
    If the child of a user changes, run this code.
\*======================================================================*/
admin.database().ref('users').on('child_changed', function(snapshot) {
    var user = snapshot.val();
    if (user.accountType === "vendor" && user.vendorRequest === true) {
        admin.database().ref('users/' + snapshot.key).update({
            vendorRequest: false
        });
        if (user.email) {
            var vendorWelcome = {
                name : user.name
            };
            templates.render('registeredVendor.html', vendorWelcome, function(err, html, text) {

                var mailOptions = {
                    from: 'info@pear.life', // sender address
                    replyTo: 'noreply@pear.life', //Reply to address
                    to: user.email, // list of receivers
                    subject: 'Pear - You are now a registered vendor', // Subject line
                    html: html, // html body
                    text: text  //Text equivalent
                };

                // send mail with defined transport object
                transporter.sendMail(mailOptions, function(error, info) {
                    if (error) {
                        console.log("VENDOR REGISTRATION ERROR");
                        return console.log(error);
                    }
                    console.log('Message sent: ' + info.response);
                });
            });

        }
    }
});

/*======================================================================*\
    If a new message request is created, run this.
\*======================================================================*/
admin.database().ref('messages').on('child_added', function(snapshot) {
    console.log("New message request");
    var message = snapshot.val();
    var mailTo = "";
    if(message.to) {
        mailTo = message.to
        admin.database().ref('users/' + message.senderId).once('value').then(function(_snapshot) {
            admin.database().ref('weddings/' + message.senderId).once('value').then(function(__snapshot) {
                var guestC = "Unknown";
                var weddingDate = "Unknown";
                if(message.sendInfo) {
                    var wedding = __snapshot.val();
                    if(wedding.estimatedGuests) {
                        guestC = wedding.estimatedGuests;
                    } else if(wedding.guestsTotal){
                        guestC = wedding.guestsTotal;
                    }
                    try{
                        var weddingDate = moment(wedding.weddingDate);
                        weddingDateFormatted = weddingDate.format('Do MMM YYYY');
                    } catch (ex) {}  
                }

                var customMessage = {
                    senderName: _snapshot.val().name || "User",
                    receiverName: message.receiverName,
                    guestCount: guestC,
                    weddingDate: weddingDateFormatted,
                    messageText: message.html
                };
                templates.render('messageRequestVendor.html', customMessage, function(err, html, text) {
                    var mailOptions = {
                        from: message.from, // sender address
                        replyTo: message.from, //Reply to address
                        to: mailTo, // list of receivers
                        subject: message.subject, // Subject line
                        html: html, // html body
                        text: text  //Text equivalent
                    };

                    // send mail with defined transport object
                    transporter.sendMail(mailOptions, function(error, info) {
                        if (error) {
                            console.log("MESSAGE REQUEST ERROR");
                            return console.log(error);
                        }
                        console.log('Message sent: ' + info.response);
                        admin.database().ref('messages/' + snapshot.key).remove();
                    });
                });
            });
          
        });
    } else { 
       
        mailTo = "support@bloomweddings.co.za";
        var customMessage = {
            senderName: "Anonymous User",
            receiverName: "Bloom Support",
            messageText: message.html
        };
        templates.render('messageRequest.html', customMessage, function(err, html, text) {
            var mailOptions = {
                from: message.from, // sender address
                replyTo: message.from, //Reply to address
                to: mailTo, // list of receivers
                subject: message.subject, // Subject line
                html: html, // html body
                text: text  //Text equivalent
            };

            // send mail with defined transport object
            transporter.sendMail(mailOptions, function(error, info) {
                if (error) {
                    console.log("MESSAGE REQUEST ERROR");
                    return console.log(error);
                }
                console.log('Message sent: ' + info.response);                    
                admin.database().ref('messages/' + snapshot.key).remove();
            });
        });
        
    }
        
});


/*======================================================================*\
    If a new account is created, run this.
\*======================================================================*/
admin.database().ref('users').on('child_added', function(snapshot) {

    var user = snapshot.val();

    var userDetails = {
        name: user.name
    };
    if(user.isNewToBloom){
        if(user.accountType){  // VENDOR. Mailed below

        } else { // USER
            templates.render('accountCreationUser.html', userDetails, function(err, html, text) {
                var mailOptions = {
                    from: "noreply@bloomweddings.co.za", // sender address
                    replyTo: "noreply@bloomweddings.co.za", //Reply to address
                    to: user.email, // list of receivers
                    subject: "Bloom - User Account Created", // Subject line
                    html: html, // html body
                    text: text  //Text equivalent
                };

                // send mail with defined transport object
                transporter.sendMail(mailOptions, function(error, info) {
                    if (error) {
                        console.log("USER DOESN'T HAVE EMAIL");
                        return console.log(error);
                    }
                    console.log('Message sent: ' + info.response);
                });
            });

            admin.database().ref('users/' + snapshot.key).update({
                isNewToBloom: null
            });
        }        
    }


});

/*======================================================================*\
    If a new vendor account is created, run this.
\*======================================================================*/
admin.database().ref('vendorLogins').on('child_added', function(snapshot) {
    var login = snapshot.val();
    if(login.passTemp){
        var userDetails = {
            password: login.passTemp,            
            id: login.vendorID
        };

        admin.database().ref('vendorLogins/' + snapshot.key).update({
            passTemp: null
        });

        templates.render('accountCreationVendor.html', userDetails, function(err, html, text) {
            var mailOptions = {
                from: "noreply@bloomweddings.co.za", // sender address
                replyTo: "noreply@bloomweddings.co.za", //Reply to address
                to: login.email, // list of receivers
                subject: "Bloom - Vendor Account Created", // Subject line
                html: html, // html body
                text: text  //Text equivalent
            };

            // send mail with defined transport object
            transporter.sendMail(mailOptions, function(error, info) {
                if (error) {
                    console.log("VENDOR DOESN'T HAVE EMAIL");
                    return console.log(error);
                }
                console.log('Message sent: ' + info.response);
            });
        });

        /*
        templates.render('accountCreation.html', userDetails, function(err, html, text) {
            var mailOptions = {
                from: "noreply@bloomweddings.co.za", // sender address
                replyTo: "noreply@bloomweddings.co.za", //Reply to address
                to: login.email, // list of receivers
                subject: "Pear - Vendor Account Created", // Subject line
                html: html, // html body
                text: text  //Text equivalent
            };

            // send mail with defined transport object
            transporter.sendMail(mailOptions, function(error, info) {
                if (error) {
                    console.log("VENDOR DOESN'T HAVE EMAIL");
                    return console.log(error);
                }
                console.log('Message sent: ' + info.response);
            });
        });

        */

        templates.render('accountCreationBcc.html', userDetails, function(err, html, text) {
            var mailOptions2 = {
                from: "noreply@bloomweddings.co.za", // sender address
                replyTo: "noreply@bloomweddings.co.za", //Reply to address
                to: "bruce@bloomweddings.co.za, ineke@bloomweddings.co.za", // list of receivers
                subject: "Bloom - Vendor Account Created", // Subject line
                html: html, // html body
                text: text  //Text equivalent
            };

            // send mail with defined transport object
            transporter.sendMail(mailOptions2, function(error, info) {
                if (error) {
                    console.log("SOMETHING WENT WRONG!");
                    return console.log(error);
                }
                console.log('Message sent: ' + info.response);
            });
        });         
    }
        
});


/*======================================================================*\
    If a new guest is created, email them
\*======================================================================*/
// admin.database().ref('guests').on('child_added', function(snapshot) {
//     var guest = snapshot.val();
//     if(guest.mustEmail){
//         admin.database().ref('weddings/' + guest.wedding).once('value').then(function(_snapshot) {
//             admin.database().ref('users/' + _snapshot.val().user).once('value').then(function(__snapshot) {
//                 var guestDetails = {
//                     name: guest.name,
//                     pearuser: __snapshot.val().name
//                 };
//                 templates.render('guestAdded.html', guestDetails, function(err, html, text) {
//                     var mailOptions = {
//                         from: "noreply@pear.life", // sender address
//                         replyTo: __snapshot.val().email || "noreply@pear.life", //Reply to address
//                         to: guest.email, // list of receivers
//                         subject: "Bloom - Added To Wedding Guest List", // Subject line
//                         html: html, // html body
//                         text: text  //Text equivalent
//                     };

//                     // send mail with defined transport object
//                     transporter.sendMail(mailOptions, function(error, info) {
//                         if (error) {
//                             admin.database().ref('guests/' + snapshot.key).update({
//                                 mustEmail: null
//                             });
//                             return console.log(error);
//                         }
//                         admin.database().ref('guests/' + snapshot.key).update({
//                             mustEmail: null
//                         });
//                         console.log('Message sent: ' + info.response);
//                     });
//                 }); 
                

//             });
//         });       
//     }
        
// });


/*======================================================================*\
    If an inner circle invite is created
\*======================================================================*/
admin.database().ref('innerCircleInvites').on('child_added', function(snapshot) {

    var invite = snapshot.val();

    var acceptUrl = "https://bloomweddings.co.za/favourites/innercircle?accept="+invite.userId;

    var details = {
        name: invite.name,
        _name: invite.sender,
        imgUrl: invite.imgUrl,
        acceptUrl: acceptUrl
    };

    if(true){ // Edit preferences will change this
        templates.render('innerCircleInvite.html', details, function(err, html, text) {
            var mailOptions = {
                from: "noreply@bloomweddings.co.za", // sender address
                replyTo: "noreply@bloomweddings.co.za", //Reply to address
                to: invite.emailId, // list of receivers
                subject: "Bloom - Inner Circle Invite", // Subject line
                html: html, // html body
                text: text  //Text equivalent
            };

            // send mail with defined transport object
            transporter.sendMail(mailOptions, function(error, info) {
                if (error) {
                    console.log("NO INVITE EMAIL ASSOCIATED");
                    return console.log(error);
                }
                console.log('Message sent: ' + info.response);
            });
        });

    } 

});

/*======================================================================*\
    If a cat-item is deleted, removed favourites from users, remove
    from provinces and categories
\*======================================================================*/
admin.database().ref('catItems').on('child_removed', function(snapshot) {
    var item = snapshot.val();                  //the deleted item
    var favouritedBy = item.favouritedBy;       //list of users who favourited the item
    var fkey = snapshot.key;                    //key of the deleted item
    //Iterate through all users
    for (var key in favouritedBy){
        if (favouritedBy.hasOwnProperty(key)) {
            //Get the user
            admin.database().ref('users/' + key).once('value').then(function(_snapshot) {
                var _user = _snapshot.val();
                var favourites = _user.favourites;
                delete favourites[fkey];        //Delete favourite key-value pair
                admin.database().ref('users/' + key).update({
                    favourites: favourites
                });
            });
        }
    }

    //Remove cat-item from assigned category and province

    var assignedCategory = item.category;
    //Get the category
    admit.database().ref('categories/' + assignedCategory).once('value').then(function(_snapshot) {
        var cat = _snapshot.val();
        var catItems = cat.catItems;
        delete catItems[fkey];                  //Delete cat-item key-value pair
        admin.database().ref('categories/' + assignedCategory).update({
            catItems: catItems
        });
    });

    var assignedProvince = item.province;
    //Get the Province
    admit.database().ref('provinces/' + assignedProvince).once('value').then(function(_snapshot) {
        var prov = _snapshot.val();
        var catItems = prov.catItems;
        delete catItems[fkey];                  //Delete cat-item key-value pair
        admin.database().ref('provinces/' + assignedProvince).update({
            catItems: catItems
        });
    });
});

/*======================================================================*\
    If a wedding is deleted, remove tasks and guests
\*======================================================================*/
admin.database().ref('weddings').on('child_removed', function(snapshot) {
    var item = snapshot.val();                  //the deleted item
    var assignedTasks = item.tasks;             //list of tasks

    //Iterate through all tasks
    for (var key in assignedTasks){
        if (assignedTasks.hasOwnProperty(key)) {
            //Get the task
            var del_ref = admin.database().ref('tasks/' + key);
            del_ref.remove();
        }
    }

    var assignedGuests = item.guests;             //list of guests

    //Iterate through all tasks
    for (var key in assignedGuests){
        if (assignedGuests.hasOwnProperty(key)) {
            //Get the task
            var del_ref = admin.database().ref('guests/' + key);
            del_ref.remove();
        }
    }
});


/*======================================================================*\
    Scheduled tasks - This breaks server, leave out for now
\*======================================================================*/
// var rule = new schedule.RecurrenceRule();
// rule.hour = 24;
// var topVendors = ['ChipFarm', '-KJeGkIxhbuJ0ur-cdXy', 'weddingstuffs'];
 
// var j = schedule.scheduleJob(rule, function(){
//   console.log("Vendor selection underway...");
//   admin.database().ref('topVendors/topvendor').once('value').then(function(snapshot) {
//     let top = snapshot.val();
//     let currentTopVendor;
//     let vendors = top.vendors;
//     for (var a in vendors){
//         currentTopVendor = a;
//         break;
//     } 
//     let newIndex = Math.floor(Math.random() * 3);
//     let newTop = topVendors[newIndex];
//     console.log("NEW VENDOR OF THE DAY: " + newTop + "!!!");
//     admin.database().ref('topVendors/topvendor').update({
//         'vendors' : {
//             [newTop]: true
//         }
//     });
//   });
// });


/*======================================================================*\
    Launch Web Server
\*======================================================================*/
app.get('/', function(req, res) {
    res.send('Hello World');
})

var server = app.listen(8081, function() {

    var host = server.address().address;
    var port = server.address().port;

    console.log("Web Server listening at localhost:" + port + "\n");

})
