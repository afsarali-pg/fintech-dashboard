$(document).ready(function () {
    // Load the upcoming deployments section and then populate the table

    let sampleData = [];
    $("#upcoming-deployments-section").load("upcoming_deployments.html", function () {
        lastSyncedTime();
        $.getJSON("./data/data.json", function (data) {
            sampleData = data.jiraTickets;
            // delete ticket for jira id FINTECH-6774
            sampleData = sampleData.filter(function (deployment) {
                return getExcludedJiraIds().includes(deployment.key) === false;
            });
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
                 var tabName = $(this).attr('id').split('-')[0]; // e.g., "core" from "core-tab"
                if(tabName === 'internal'){
                    tabName = 'internal tools';
                }
                var filteredData = tabName === 'all' ? sampleData : sampleData.filter(function (deployment) {
                    return deployment.team.toLowerCase() === tabName;
                });

                if(tabName === 'guruland' || tabName === 'symbiosis') {
                    filteredData = filterBasedOnServiceName(sampleData, tabName);
                }

                populateDeploymentsTable(filteredData);
            });

        });
    });

    $.getJSON("./data/data.json", function(data) {
        var date = new Date(data.upcomingGurulandDeploymentDate);

        var glDate = formatDateTime(date);
        $(".gl-date").text(glDate);

        // All deployment date (Guruland + 1 day)
        date.setDate(date.getDate() + 1);
        var allDate = formatDateTime(date);
        $(".all-deployment").text(allDate);
    });

    // on hover of pr link, show tooltip
    $(document).on('mouseover', '#tooltip', function () {
        $(this).tooltip();
    });

    function getStatus(deployment) {
        if (!deployment.isReviewed) {
            return '<span class="badge badge-warning">Pending Review</span>';
        } else if (deployment.isReviewed && !deployment.isMerged) {
            return '<span class="badge badge-info">Pending Merge/QA</span>';
        } else if (deployment.isReviewed && deployment.isMerged && !deployment.isDeployed) {
            return '<span class="badge badge-primary">Pending Deployment</span>';
        } else if (deployment.isReviewed && deployment.isMerged && deployment.isDeployed && !deployment.isChildTicket) {
            return '<span class="badge badge-success">Deployed</span>';
        } else if (deployment.isReviewed && deployment.isMerged && deployment.isDeployed && deployment.isChildTicket) {
            return '<span class="badge badge-success">Merged to Parent PR</span>';
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
    <span class="badge badge-${pr.status === 'MERGED' ? 'success' : 'warning'}" >${pr.status}</span>
<!--    If status is deployed then primary -->
<!--Make sure even if pr.isDeployed = true, check for isChildPr, if childPr=true then in this case status is 'Merged to Parent PR'-->
     <span id="tooltip" class="badge badge-${pr.isDeployed  ? `primary" title="Merged on: ${formatDateTime(new Date(pr.lastUpdate))}"` : ''} ">${pr.isDeployed && !pr.isChildPr ? 'Deployed' : `${pr.isDeployed && pr.isChildPr ? 'Merged to Parent PR': ''}`}</span>
    
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

    function timeSince(date) {
        var seconds = Math.floor((new Date() - date) / 1000);
        var interval = Math.floor(seconds / 31536000);

        if (interval > 1) {
            return interval + " years ago";
        }
        interval = Math.floor(seconds / 2592000);
        if (interval > 1) {
            return interval + " months ago";
        }
        interval = Math.floor(seconds / 86400);
        if (interval > 1) {
            return interval + " days ago";
        }
        interval = Math.floor(seconds / 3600);
        if (interval > 1) {
            return interval + " hours ago";
        }
        interval = Math.floor(seconds / 60);
        if (interval > 1) {
            return interval + " minutes ago";
        }
        return Math.floor(seconds) + " seconds ago";
    }

    function lastSyncedTime() {
        // Read the last synced time from the data.json file and display it
        $.getJSON("./data/data.json", function (data) {
            const date = new Date(data.syncDate);
            const formattedDate = `Last Synced : ${timeSince(date)}`;
            $(".sync-time").text(formattedDate);
        });
    }

    function sortTable(sortField) {
            //Pending Deployment -> Pending Merge/QA -> Pending Review -> Deployed
            sampleData.sort(function (a, b) {
                // Based on isDeployed, isMerged, isReviewed
                if (sortField === 'status') {
                    if (!a.isReviewed && b.isReviewed) return -1;
                    if (a.isReviewed && !b.isReviewed) return 1;
                    if (a.isReviewed && !a.isMerged && b.isMerged) return -1;
                    if (a.isMerged && !b.isMerged) return 1;
                    if (a.isMerged && !a.isDeployed && b.isDeployed) return -1;
                    if (a.isDeployed && !b.isDeployed) return 1;
                    return 0;
                }

                // Based on dev_name
                if (a[sortField] < b[sortField]) return -1;
            });

        populateDeploymentsTable(sampleData);
    }
});

function formatDateTime(date) {
    var options = {weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'};
    return date.toLocaleDateString('en-GB', options);
}

function getDeploymentDate(serviceName, data) {

    if(serviceName === 'guruland'){
        return new Date(data.upcomingGurulandDeploymentDate);
    }

    if(serviceName.contains('symbiosis') || serviceName.contains('symbiosis-config') || serviceName.contains('hive')){
        return new Date(data.lastSymbiosisDeploymentDate);
    }
}

function  filterBasedOnServiceName(sampleData, serviceNames) {
    return sampleData.filter(function (deployment) {
       if(serviceNames.toLowerCase() === 'guruland' && deployment.isGuruland) {
           return true;
       }
       if(serviceNames.toLowerCase() === 'symbiosis' && deployment.isSymbiosis) {
              return true;
         }
    });
}

function getExcludedJiraIds() {
    return ['FINTECH-6757','FINTECH-6774','FINTECH-6490'];
}
