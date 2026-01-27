async function sendLoginCodeEmail({ email, code }) {
  // TODO: replace with real email provider integration.
  console.log(`Login code for ${email}: ${code}`);
}

export { sendLoginCodeEmail };
