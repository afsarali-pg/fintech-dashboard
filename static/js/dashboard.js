$(document).ready(function () {
    // Load the upcoming deployments section and then populate the table

    let sampleData = [];
    $("#upcoming-deployments-section").load("upcoming_deployments.html", function () {
        $.getJSON("./data/data.json", function (data) {
            sampleData = data.jiraTickets;
            populateDeploymentsTable(sampleData);

            // Add sort functionality
            $("#deployments-table thead th").on("click", function () {
                var sortField = $(this).data("sort");
                sortTable(sortField);
            });

            // Add search functionality
            $("#search-deployments").on("keyup", function () {
                var searchTerm = $(this).val().toLowerCase();
                $("#deployments-table tbody tr").each(function () {
                    var rowText = $(this).text().toLowerCase();
                    $(this).toggle(rowText.includes(searchTerm));
                });

                // find the number of results
                var filteredResult = $(".results-found-text .result");
                var resultCount = $("#deployments-table tbody tr:visible").length;
                filteredResult.text(resultCount);
            });

            // Add tab click functionality
            $('#teamTabs a').on('click', function (e) {
                e.preventDefault();
                $(this).tab('show');
                 var team = $(this).attr('id').split('-')[0]; // e.g., "core" from "core-tab"
                if(team === 'internal'){
                    team = 'internal tools';
                }
                var filteredData = team === 'all' ? sampleData : sampleData.filter(function (deployment) {
                    return deployment.team.toLowerCase() === team;
                });

                populateDeploymentsTable(filteredData);
            });

        });
    });

    $.getJSON("./data/data.json", function(data) {
        var date = new Date(data.upcomingGurulandDeploymentDate);
        var options = {weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'};

        // Guruland deployment date
        var glDate = date.toLocaleDateString('en-GB', options);
        $(".gl-date").text(glDate);

        // All deployment date (Guruland + 1 day)
        date.setDate(date.getDate() + 1);
        var allDate = date.toLocaleDateString('en-GB', options);
        $(".all-deployment").text(allDate);
    });


    function getStatus(deployment) {
        if (!deployment.isReviewed) {
            return '<span class="badge badge-warning">Pending Review</span>';
        } else if (deployment.isReviewed && !deployment.isMerged) {
            return '<span class="badge badge-info">Pending Merge/QA</span>';
        } else if (deployment.isReviewed && deployment.isMerged && !deployment.isDeployed) {
            return '<span class="badge badge-primary">Pending Deployment</span>';
        } else if (deployment.isReviewed && deployment.isMerged && deployment.isDeployed) {
            return '<span class="badge badge-success">Deployed</span>';
        }
        return '';
    }

    function populateDeploymentsTable(filteredData) {
        var tbody = $("#upcoming-deployments");
        tbody.empty();

        var filteredResult = $(".results-found-text .result");
        filteredResult.text(filteredData.length);
        $.each(filteredData, function (index, deployment) {
            var prLinks = deployment.pull_requests.map(function (pr) {
                return `<a href="${pr.url}" target="_blank">${pr.repositoryName.replace("project-", "").replace('pg-', '')}
<!--if merged then success else warning-->
    <span class="badge badge-${pr.status === 'MERGED' ? 'success' : 'warning'}">${pr.status}</span>
<!--    If status is deployed then primary -->
    <span class="badge badge-${pr.isDeployed ? 'primary' : ''} ">${pr.isDeployed ? 'Deployed' : ''}</span>
       
</a>`;
            }).join("<br>");
            var jiraLink = `https://propertyguru.atlassian.net/browse/${deployment.key}`

            var row = `
                <tr>
                    <!--  Add Link to jira key-->
                    <td class="jira-id"><a href="${jiraLink}" target="_blank">${deployment.key}</a></td>
                    <td>${deployment.jira_title || ''}</td>
                    <td>${deployment.dev_name}</td>
                    <td>
                       ${getStatus(deployment)}
                    </td>
                    <td class="pr-link">${prLinks}</td>
                </tr>
            `;
            tbody.append(row);
        });
    }

    function sortTable(sortField) {
        sampleData.sort(function (a, b) {
            if (a[sortField] < b[sortField]) return -1;
            if (a[sortField] > b[sortField]) return 1;
            return 0;
        });
        populateDeploymentsTable(sampleData);
    }
});
