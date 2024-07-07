$(document).ready(function () {
    // Load the upcoming deployments section and then populate the table
    $("#upcoming-deployments-section").load("upcoming_deployments.html", function () {
        $.getJSON("./data/PR.json", function (data) {
            sampleData = data.jiraTickets;
            populateDeploymentsTable();

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
            });
        });
    });

    let sampleData = [];

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

    function populateDeploymentsTable() {
        var tbody = $("#upcoming-deployments");
        tbody.empty();

        $.each(sampleData, function (index, deployment) {
            var prLinks = deployment.pull_requests.map(function (pr) {
                return `<a href="${pr.url}" target="_blank">${pr.repositoryName} 
<!--if merged then success else warning-->
<span class="badge badge-${pr.status === 'MERGED' ? 'success' : 'warning'}">${pr.status}</span>
       
</a>`;
            }).join("<br>");

            var row = `
                <tr>
                    <td class="jira-id">${deployment.key}</td>
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
        populateDeploymentsTable();
    }
});
