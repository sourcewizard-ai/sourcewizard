import mailchimp from "@mailchimp/mailchimp_marketing";

async function addListMember(email: string, tags: string[]) {
  if (!process.env.MAILCHIMP_LIST_ID) {
    throw new Error("MAILCHIMP_LIST_ID is not set");
  }
  if (!process.env.MAILCHIMP_API_KEY) {
    throw new Error("MAILCHIMP_API_KEY is not set");
  }
  if (!process.env.MAILCHIMP_SERVER) {
    throw new Error("MAILCHIMP_SERVER is not set");
  }
  mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: process.env.MAILCHIMP_SERVER,
  });

  try {
    await mailchimp.lists.addListMember(process.env.MAILCHIMP_LIST_ID, {
      email_address: email,
      status: "subscribed",
      tags: tags,
    });
    return;
  } catch (error) {
    const err: any = error;
    if (
      "response" in err &&
      "body" in err.response &&
      "title" in err.response.body &&
      err.response.body.title === "Member Exists"
    ) {
      return;
    }
    throw error;
  }
}
