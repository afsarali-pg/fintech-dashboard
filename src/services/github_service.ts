import axios from "axios";

export class GithubService{

    public async getLastDeploymentDate(serviceName: string){
        const response = await axios.get(`https://api.github.com/repos/propertyguru/${serviceName}/releases`, {
            headers: this.getHeader()
        })

        const lastDeployment =  response.data[0];
        return {
            url: lastDeployment?.url,
            tag_name: lastDeployment?.tag_name,
            published_at: lastDeployment?.published_at
        }
    }

    private getHeader(){
        return {
            Authorization: 'token ' + process.env.GH_AUTH_TOKEN,
            'X-GitHub-Api-Version': '2022-11-28'
        }
    }

}
