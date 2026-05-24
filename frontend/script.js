const API_BASE =
    `http://${window.location.hostname}:3000`;

const socket =
    io(API_BASE);

const token =
    localStorage.getItem('token');

if (!token) {
    window.location.href =
        'login.html';
}

const headers = {
    Authorization:
        `Bearer ${token}`
};

let metricsChart;

let selectedServer = '';

let customStart = null;
let customEnd = null;

//
// USER INFO
//

const username =
    localStorage.getItem('username');

const role =
    localStorage.getItem('role');

document.getElementById(
    'user-info'
).innerText =
    `${username} (${role})`;

//
// LOGOUT
//

function logout() {

    localStorage.clear();

    window.location.href =
        'login.html';

}

//
// SOCKET REALTIME
//

socket.on(
    'metrics-update',
    () => {

        loadLatestMetrics();
        loadHistory();

    }
);

//
// LOAD SERVERS
//

async function loadServers() {

    try {

        const response =
            await fetch(
                `${API_BASE}/metrics/servers`,
                {
                    headers
                }
            );

        const servers =
            await response.json();

        const select =
            document.getElementById(
                'server-filter'
            );

        select.innerHTML =
            `<option value="">Todos</option>`;

        servers.forEach(server => {

            select.innerHTML += `

                <option value="${server.id}">
                    ${server.hostname}
                </option>

            `;

        });

    } catch (error) {

        console.error(error);

    }

}

//
// CHANGE SERVER
//

function changeServer() {

    selectedServer =
        document.getElementById(
            'server-filter'
        ).value;

    loadLatestMetrics();
    loadHistory();

}

//
// CHANGE PERIOD
//

function changePeriod() {

    loadHistory();

}

//
// APPLY CUSTOM PERIOD
//

function applyCustomPeriod() {

    customStart =
        document.getElementById(
            'custom-start'
        ).value;

    customEnd =
        document.getElementById(
            'custom-end'
        ).value;

    loadHistory();

}

//
// LOAD METRICS
//

async function loadLatestMetrics() {

    try {

        let url =
            `${API_BASE}/metrics/latest`;

        if (selectedServer) {

            url +=
                `?server_id=${selectedServer}`;

        }

        const response =
            await fetch(
                url,
                {
                    headers
                }
            );

        const data =
            await response.json();

        document.getElementById(
            'cpu-value'
        ).innerText =
            `${data.cpu_usage.toFixed(1)}%`;

        document.getElementById(
            'memory-value'
        ).innerText =
            `${data.memory_usage.toFixed(1)}%`;

        document.getElementById(
            'disk-value'
        ).innerText =
            `${data.disk_usage.toFixed(1)}%`;

        document.getElementById(
            'server-name'
        ).innerText =
            data.hostname || '-';

    } catch (error) {

        console.error(error);

    }

}

//
// LOAD HISTORY
//

async function loadHistory() {

    try {

        const period =
            document.getElementById(
                'period-filter'
            ).value;

        let url =
            `${API_BASE}/metrics/history?period=${period}`;

        if (selectedServer) {

            url +=
                `&server_id=${selectedServer}`;

        }

        if (
            customStart &&
            customEnd
        ) {

            url +=
                `&start=${customStart}&end=${customEnd}`;

        }

        const response =
            await fetch(
                url,
                {
                    headers
                }
            );

        const data =
            await response.json();

        renderChart(data);

    } catch (error) {

        console.error(error);

    }

}

//
// RENDER CHART
//

function renderChart(data) {

    const ctx =
        document.getElementById(
            'metricsChart'
        ).getContext('2d');

    if (metricsChart) {

        metricsChart.destroy();

    }

    metricsChart =
        new Chart(ctx, {

            type: 'line',

            data: {

                labels:
                    data.labels,

                datasets: [

                    {

                        label: 'CPU',

                        data:
                            data.cpu,

                        borderWidth: 2

                    },

                    {

                        label: 'Memória',

                        data:
                            data.memory,

                        borderWidth: 2

                    }

                ]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false

            }

        });

}

//
// LOAD ALERTS
//

async function loadAlerts() {

    try {

        const response =
            await fetch(
                `${API_BASE}/metrics/alerts`,
                {
                    headers
                }
            );

        const alerts =
            await response.json();

        const container =
            document.getElementById(
                'alerts-container'
            );

        container.innerHTML = '';

        alerts.forEach(alert => {

            container.innerHTML += `

                <div class="alert-item">

                    <strong>
                        ${alert.metric_name}
                    </strong>

                    <span>
                        ${alert.value}
                    </span>

                </div>

            `;

        });

    } catch (error) {

        console.error(error);

    }

}

//
// INITIAL LOAD
//

loadServers();
loadLatestMetrics();
loadHistory();
loadAlerts();

setInterval(() => {

    loadLatestMetrics();
    loadAlerts();

}, 5000);