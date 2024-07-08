import {JiraService} from "./services/jira_service";
import {GithubService} from "./services/github_service";
import * as fs from "node:fs";
import 'dotenv/config';

async function run(){
    const jiraService = new JiraService();
    const github = new GithubService();
   // const prDetails = await jiraService.pullRequestDetails()
    const jiraList  = await jiraService.buildJiraStatusDto();
    // Now store the jiraList in a json file

    // check json jiraList is not empty or null
    if(jiraList == null){
        console.log("No Jira issues found");
        throw new Error("No Jira issues found");
    }

    const jsonData = JSON.stringify(jiraList, null, 2);
    const FILE_PATH = './static/data/data.json';

    // if file exists, delete it
    if(fs.existsSync(FILE_PATH)){
        fs.unlinkSync(FILE_PATH);
        console.log("Deleted existing file");
    }

    fs.writeFileSync(FILE_PATH, jsonData);
    console.log(jiraList);
}

run().then((r) => console.log("Done"))
    .catch((e) => console.error("Terminated with error: ", e.message || ""));
