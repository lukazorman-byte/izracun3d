const net=require("net");let msgs=0;
net.createServer(c=>{let data=false,buf="",auth=0;c.write("220 mock\r\n");c.on("data",d=>{buf+=d;let i;while((i=buf.indexOf("\r\n"))>=0){const l=buf.slice(0,i);buf=buf.slice(i+2);
if(data){if(l==="."){data=false;msgs++;c.write("250 ok\r\n")}continue}
if(/^EHLO/.test(l))c.write("250-mock\r\n250 AUTH LOGIN\r\n");
else if(l==="AUTH LOGIN"){auth=1;c.write("334 VXNlcm5hbWU6\r\n")}
else if(auth===1){auth=2;c.write("334 UGFzc3dvcmQ6\r\n")}
else if(auth===2){auth=3;c.write("235 ok\r\n")}
else if(/^MAIL|^RCPT/.test(l))c.write("250 ok\r\n");
else if(l==="DATA"){data=true;c.write("354 go\r\n")}
else if(l==="QUIT"){c.write("221 bye\r\n");c.end()}}})}).listen(2525,()=>console.log("mock 2525"));
setTimeout(()=>process.exit(0),120000);
