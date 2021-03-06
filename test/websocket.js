const assert = require("assert");
const nodemailer = require("nodemailer");
const request = require("supertest");
const WebSocket = require("ws");

const mailsacAPIKey = ""; // Generated by mailsac. See https://mailsac.com/api-keys
const mailsacToAddress = ""; // Mailsac email address where the email will be sent
const smtpUserName = ""; // Username for smtp server authentication
const smtpPassword = ""; // Password for smtp server authentication
const smtpHost = ""; // hostname of the smtp server
const smtpPort = 587; // port the smtp is listening on

let ws;

describe("send email to mailsac", function () {
  this.timeout(50000); // test can take a long time to run. This increases the default timeout for mocha

  /* delete all messages in the inbox after the test runs to prevent leaky tests.
       This requires the inbox to private, which is a paid feature of Mailsac.
       The afterEach section could be omitted if using a public address
    */
  after(() =>
    request("https://mailsac.com")
      .delete(`/api/addresses/${mailsacToAddress}/messages`)
      .set("Mailsac-Key", mailsacAPIKey)
      .expect(204)
  );
  // close websocket after all tests finish
  after(() => ws.close());

  // Open websocket waiting for email. This websocket will be reused for tests in this file.
  before(() => {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(
        `wss://sock.mailsac.com/incoming-messages?key=${mailsacAPIKey}&addresses=${mailsacToAddress}`
      );
      ws.on("message", (msg) => {
        try {
          const wsMessage = JSON.parse(msg);
        } catch {
          assert(wsMessage, "Failed to parse JSON from websocket message");
        }
        if (wsMessage.status != 200) {
          reject("connection error: " + wsMessage.error);
          return;
        }
        resolve(wsMessage);
      });
      ws.on("error", (err) => {
        reject(err);
      });
    });
  });

  it("sends email with link to example.com website", async () => {
    // create a transporter object using the default SMTP transport
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      auth: {
        user: smtpUserName,
        pass: smtpPassword,
      },
    });
    // send mail using the defined transport object
    const result = await transport.sendMail({
      from: smtpUserName, // sender address
      to: mailsacToAddress, // recipient address
      subject: "Hello!",
      text: "Check out https://example.com",
      html: "Check out <a href https://example.com>My website</a>",
    });

    // logs the messageId of the email, confirming the email was submitted to the smtp server
    console.log("Sent email with messageId: ", result.messageId);

    // wait for email to be received and sent through the websocket.
    const wsMessage = await new Promise((resolve) => {
      ws.on("message", (msg) => {
        const wsResponse = JSON.parse(msg);
        if (wsResponse.to) {
          resolve(wsResponse);
        }
      });
    });

    assert(wsMessage, "Never received messages!");

    // After a message is retrieved from mailsac, the JSON object is checked to see if the subject and email text are what was expected.
    const subject = wsMessage.subject;
    const email_text = wsMessage.text;
    assert.equal(subject, "Hello!");
    assert.equal(email_text, "Check out https://example.com");
  });

  // Sends a second email reusing the websocket.
  it("sends email with link to unsubscribe.example.com website", async () => {
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      auth: {
        user: smtpUserName,
        pass: smtpPassword,
      },
    });
    const result = await transport.sendMail({
      from: smtpUserName, // sender address
      to: mailsacToAddress, // recipient address
      subject: "Unsubscribe",
      text: "Click the link to unsubscribe https://unsubscribe.example.com",
      html: "Check out <a href https://example.com>My website</a>",
    });

    console.log("Sent email with messageId: ", result.messageId);

    const wsMessage = await new Promise((resolve) => {
      ws.on("message", (msg) => {
        const wsResponse = JSON.parse(msg);
        if (wsResponse.to) {
          resolve(wsResponse);
        }
      });
    });

    assert(wsMessage, "Never received messages!");

    const subject = wsMessage.subject;
    const email_text = wsMessage.text;
    assert.equal(subject, "Unsubscribe");
    assert.equal(
      email_text,
      "Click the link to unsubscribe https://unsubscribe.example.com"
    );
  });
});
