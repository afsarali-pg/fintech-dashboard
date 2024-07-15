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
                $("#accordion .collapse.show").each(function () {
                    var statusTable = $(this).find("table");
                    var visibleRows = statusTable.find("tbody tr:visible");
                    visibleRows.hide();

                    statusTable.find("tbody tr").each(function () {
                        var rowText = $(this).text().toLowerCase();
                        if (rowText.includes(searchTerm)) {
                            $(this).show();
                        }
                    });
                });

                // Update filtered result count
                var filteredResult = $(".results-found-text .result");
                var resultCount = $(".card-body #accordion div.card-body tr:visible").length;
                filteredResult.text(resultCount);
            });

            // Add tab click functionality
            $('#teamTabs a').on('click', function (e) {
                e.preventDefault();
                $(this).tab('show');
                var team = $(this).attr('id').split('-')[0]; // e.g., "core" from "core-tab"
                if (team === 'internal') {
                    team = 'internal tools';
                }
                var filteredData = team === 'all' ? sampleData : sampleData.filter(function (deployment) {
                    return deployment.team.toLowerCase() === team;
                });

                populateDeploymentsTable(filteredData);
            });

        });
    });

    $.getJSON("./data/data.json", function (data) {
        var date = new Date(data.upcomingGurulandDeploymentDate);
        var options = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' };

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
            return 'Pending Review';
        } else if (deployment.isReviewed && !deployment.isMerged) {
            return 'Pending Merge/QA';
        } else if (deployment.isReviewed && deployment.isMerged && !deployment.isDeployed) {
            return 'Pending Deployment';
        } else if (deployment.isReviewed && deployment.isMerged && deployment.isDeployed) {
            return 'Deployed';
        }
        return '';
    }

    function populateDeploymentsTable(filteredData) {
        var tbodyPendingReview = $("#status-pending-review tbody");
        var tbodyPendingMergeQA = $("#status-pending-merge-qa tbody");
        var tbodyPendingDeployment = $("#status-pending-deployment tbody");
        var tbodyDeployed = $("#status-deployed tbody");

        tbodyPendingReview.empty();
        tbodyPendingMergeQA.empty();
        tbodyPendingDeployment.empty();
        tbodyDeployed.empty();

        var filteredResult = $(".results-found-text .result");
        filteredResult.text(filteredData.length);

        $.each(filteredData, function (index, deployment) {
            var prLinks = deployment.pull_requests.map(function (pr) {
                return `<a href="${pr.url}" target="_blank">${pr.repositoryName.replace("project-", "").replace('pg-', '')}
    <span class="badge badge-${pr.status === 'MERGED' ? 'success' : 'warning'}">${pr.status}</span>
    <span class="badge badge-${pr.isDeployed ? 'primary' : ''} ">${pr.isDeployed ? 'Deployed' : ''}</span>
</a>`;
            }).join("<br>");
            var jiraLink = `https://propertyguru.atlassian.net/browse/${deployment.key}`;

            var row = `
                <tr>
                    <td class="jira-id"><a href="${jiraLink}" target="_blank">${deployment.key}</a></td>
                    <td>${deployment.jira_title || ''}</td>
                    <td>${deployment.dev_name}</td>
                    <td class="pr-link">${prLinks}</td>
                </tr>
            `;

            switch (getStatus(deployment)) {
                case 'Pending Review':
                    tbodyPendingReview.append(row);
                    break;
                case 'Pending Merge/QA':
                    tbodyPendingMergeQA.append(row);
                    break;
                case 'Pending Deployment':
                    tbodyPendingDeployment.append(row);
                    break;
                case 'Deployed':
                    tbodyDeployed.append(row);
                    break;
            }
            updateGroupCount();
        });

        function updateGroupCount() {
            var groupCount = $(".group-count");
            var pendingReviewCount = tbodyPendingReview.find("tr").length;
            var pendingMergeQACount = tbodyPendingMergeQA.find("tr").length;
            var pendingDeploymentCount = tbodyPendingDeployment.find("tr").length;
            var deployedCount = tbodyDeployed.find("tr").length;

            groupCount.eq(0).text(pendingReviewCount);
            groupCount.eq(1).text(pendingMergeQACount);
            groupCount.eq(2).text(pendingDeploymentCount);
            groupCount.eq(3).text(deployedCount);
        }
    }

    function populateSearchResults(searchTerm) {
        var searchResults = sampleData.filter(function (deployment) {
            return deployment.jira_title.toLowerCase().includes(searchTerm);
        });
        //populateDeploymentsTable(searchResults);
        // Headers - Jira Id, Jira Title, Team Name,  Dev Name, Status, PR Link
        // Rows - Jira Id, Jira Title, Team Name,  Dev Name, Status, PR Link

        // create new Table under `.card-body #accordion` with id `search-results`
        // create new Table Header with id `search-results-header`
        // create new Table Body with id `search-results-body`

        $("#accordion").append(`<div class="card">
            <div class="card-header" id="search-results-header">
                <h5 class="mb-0">
                    <button class="btn btn-link" data-toggle="collapse" data-target="#search-results" aria-expanded="true" aria-controls="search-results">
                        Search Results
                    </button>
                </h5>
            </div>
            <div id="search-results" class="collapse show" aria-labelledby="search-results-header" data-parent="#accordion">
                <div class="card-body">
                    <table class="table table-striped" id="search-results-table">
                        <thead>
                            <tr>
                                <th>Jira Id</th>
                                <th>Jira Title</th>
                                <th>Team Name</th>
                                <th>Dev Name</th>
                                <th>Status</th>
                                <th>PR Link</th>
                            </tr>
                        </thead>
                        <tbody id="search-results-body">
                        </tbody>
                    </table>
                </div>
            </div> 
         </div>`);

    }

    function populateSearchResultsTable(searchResults) {
        var tbody = $("#search-results-body");
        tbody.empty();
        $.each(searchResults, function (index, deployment) {
            var prLinks = deployment.pull_requests.map(function (pr) {
                return `<a href="${pr.url}" target="_blank">${pr.repositoryName.replace("project-", "").replace('pg-', '')}`;
            }
            ).join("<br>");
            var jiraLink = `https://propertyguru.atlassian.net/browse/${deployment.key}`;
            var row = `
                <tr>
                    <td class="jira-id"><a href="${jiraLink}" target="_blank">${deployment.key}</a></td>
                    <td>${deployment.jira_title || ''}</td>
                    <td>${deployment.team}</td>
                    <td>${deployment.dev_name}</td>
                    <td>${getStatus(deployment)}</td>
                    <td class="pr-link">${prLinks}</td>
                </tr>
            `;

            tbody.append(row);
        }
        );
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
