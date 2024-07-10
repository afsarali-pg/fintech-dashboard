import axios from "axios";

export class GithubService{

    public async getLastDeploymentDate(serviceName: string){
        const response = await axios.get(`https://api.github.com/repos/propertyguru/${serviceName}/releases`, {
            headers: this.getHeader()
        })

        // Here i need to filter based on Tags name (v4.6.1-prerelease.0 or v4.6.1) , if tag name contains prerelease then ignore that and get the last deployment
        const lastDeployment = response.data.find((release: any) => !release.tag_name.includes('prerelease'));
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
