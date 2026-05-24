const socket = io('http://localhost:3000');

const authToken = localStorage.getItem('token');
const userRole = localStorage.getItem('role');

if (!authToken) {
    window.location.href = 'login.html';
}

const cpuElement = document.getElementById('cpu');
const memoryElement = document.getElementById('memory');
const diskElement = document.getElementById('disk');

const cpuBar = document.getElementById('cpu-bar');
const memoryBar = document.getElementById('memory-bar');
const diskBar = document.getElementById('disk-bar');

const hostnameElement = document.getElementById('hostname');
const platformElement = document.getElementById('platform');

const alertsList = document.getElementById('alerts-list');
const serversGrid = document.getElementById('servers-grid');

const logsContainer =
    document.getElementById('logs-container');

const alertRulesList =
    document.getElementById('alert-rules-list');

const alertRuleForm =
    document.getElementById('alert-rule-form');

const alertRuleName =
    document.getElementById('alert-rule-name');

const alertRuleServer =
    document.getElementById('alert-rule-server');

const alertRuleMetric =
    document.getElementById('alert-rule-metric');

const alertRuleOperator =
    document.getElementById('alert-rule-operator');

const alertRuleThreshold =
    document.getElementById('alert-rule-threshold');

const alertRuleDuration =
    document.getElementById('alert-rule-duration');

const periodFilter =
    document.getElementById('period-filter');

const customFilter =
    document.getElementById('custom-filter');

const startDateInput =
    document.getElementById('start-date');

const endDateInput =
    document.getElementById('end-date');

const applyCustomFilterButton =
    document.getElementById(
        'apply-custom-filter'
    );

const serverFilter =
    document.getElementById(
        'server-filter'
    );

const dashboardServerFilter =
    document.getElementById(
        'dashboard-server-filter'
    );

const alertServerFilter =
    document.getElementById(
        'alert-server-filter'
    );

const cpuCtx =
    document.getElementById('cpuChart');

const cpuChart = new Chart(cpuCtx, {

    type: 'line',

    data: {

        labels: [],

        datasets: [{

            label: 'CPU %',

            data: [],

            borderWidth: 2,

            tension: 0.4,

            fill: false

        }]

    },

    options: {

        responsive: true,

        plugins: {

            legend: {
                display: false
            }

        },

        scales: {

            y: {

                beginAtZero: true,

                max: 100

            }

        }

    }

});

const memoryCtx =
    document.getElementById('memoryChart');

const memoryChart = new Chart(memoryCtx, {

    type: 'line',

    data: {

        labels: [],

        datasets: [{

            label: 'Memória %',

            data: [],

            borderWidth: 2,

            tension: 0.4,

            fill: false

        }]

    },

    options: {

        responsive: true,

        plugins: {

            legend: {
                display: false
            }

        },

        scales: {

            y: {

                beginAtZero: true,

                max: 100

            }

        }

    }

});

function getSelectedDashboardServer() {

    return dashboardServerFilter?.value || 'all';

}

function getSelectedMetricServer() {

    return serverFilter?.value || 'all';

}

function getSelectedAlertServer() {

    return alertServerFilter?.value || 'all';

}

async function loadMetrics() {

    try {

        const selectedServer =
            getSelectedDashboardServer();

        const response =
            await fetch(

                `http://localhost:3000/metrics/latest?server_id=${selectedServer}`,

                {
                    headers: {
                        Authorization:
                            `Bearer ${authToken}`
                    }
                }

            );

        const data =
            await response.json();

        cpuElement.innerText =
            data.cpu_usage + '%';

        memoryElement.innerText =
            data.memory_usage + '%';

        diskElement.innerText =
            data.disk_usage + '%';

        cpuBar.style.width =
            data.cpu_usage + '%';

        memoryBar.style.width =
            data.memory_usage + '%';

        diskBar.style.width =
            data.disk_usage + '%';

        hostnameElement.innerText =
            data.hostname;

        platformElement.innerText =
            data.platform;

    } catch (error) {

        console.error(
            'Erro métricas:',
            error
        );

    }

}

async function loadHistory() {

    try {

        const period =
            periodFilter?.value || '15m';

        const selectedServer =
            getSelectedMetricServer();

        let url =
            `http://localhost:3000/metrics/history?period=${period}&server_id=${selectedServer}`;

        if (period === 'custom') {

            const start =
                startDateInput.value;

            const end =
                endDateInput.value;

            if (!start || !end) {
                return;
            }

            url =
                `http://localhost:3000/metrics/history?start=${start}&end=${end}&server_id=${selectedServer}`;

        }

        const response =
            await fetch(
                url,
                {
                    headers: {
                        Authorization:
                            `Bearer ${authToken}`
                    }
                }
            );

        const data =
            await response.json();

        cpuChart.data.labels =
            data.labels;

        cpuChart.data.datasets[0].data =
            data.cpu;

        memoryChart.data.labels =
            data.labels;

        memoryChart.data.datasets[0].data =
            data.memory;

        cpuChart.update();

        memoryChart.update();

    } catch (error) {

        console.error(
            'Erro histórico:',
            error
        );

    }

}

async function loadAlerts() {

    try {

        const selectedServer =
            getSelectedAlertServer();

        const response =
            await fetch(

                `http://localhost:3000/metrics/alerts?server_id=${selectedServer}`,

                {
                    headers: {
                        Authorization:
                            `Bearer ${authToken}`
                    }
                }

            );

        const alerts =
            await response.json();

        alertsList.innerHTML = '';

        if (alerts.length === 0) {

            alertsList.innerHTML = `

                <div class="card">
                    <p>
                        Nenhum alerta encontrado.
                    </p>
                </div>

            `;

            return;

        }

        alerts.forEach(alert => {

            const div =
                document.createElement('div');

            div.classList.add(
                'alert-item'
            );

            div.innerHTML = `

                <h3>
                    ${alert.metric_name}
                </h3>

                <p>
                    Valor:
                    ${Number(alert.value).toFixed(2)}
                </p>

                <p>
                    Status:
                    ${alert.status}
                </p>

                <p>
                    Servidor:
                    ${alert.server_name || '-'}
                </p>

                <p>
                    ${new Date(
                        alert.raised_at
                    ).toLocaleString()}
                </p>

            `;

            alertsList.appendChild(div);

        });

    } catch (error) {

        console.error(
            'Erro alertas:',
            error
        );

    }

}

async function loadLogs() {

    try {

        const response =
            await fetch(

                'http://localhost:3000/metrics/logs',

                {
                    headers: {
                        Authorization:
                            `Bearer ${authToken}`
                    }
                }

            );

        const logs =
            await response.json();

        logsContainer.innerHTML = '';

        logs.reverse().forEach(
            addLogToUI
        );

    } catch (error) {

        console.error(
            'Erro logs:',
            error
        );

    }

}

function addLogToUI(log) {

    if (!logsContainer) return;

    const div =
        document.createElement('div');

    div.classList.add(
        'log-item',
        log.level
    );

    div.innerHTML = `

        <div class="log-header">

            <span>
                ${log.level}
            </span>

            <span>
                ${new Date(
                    log.created_at
                ).toLocaleString()}
            </span>

        </div>

        <div class="log-message">

            ${log.message}

        </div>

    `;

    logsContainer.prepend(div);

    if (
        logsContainer.children.length > 100
    ) {

        logsContainer.removeChild(
            logsContainer.lastChild
        );

    }

}

async function loadAlertRules() {

    try {

        if (userRole !== 'admin') {
            return;
        }

        const response =
            await fetch(

                'http://localhost:3000/metrics/alert-rules',

                {
                    headers: {
                        Authorization:
                            `Bearer ${authToken}`
                    }
                }

            );

        const rules =
            await response.json();

        alertRulesList.innerHTML = '';

        rules.forEach(rule => {

            const div =
                document.createElement('div');

            div.classList.add(
                'alert-rule-item'
            );

            div.innerHTML = `

                <h4>
                    ${rule.name}
                </h4>

                <p>
                    Servidor:
                    ${rule.server_name || 'Todos'}
                </p>

                <p>
                    Métrica:
                    ${rule.metric_name}
                </p>

                <p>
                    Condição:
                    ${rule.operator}
                    ${rule.threshold}
                </p>

                <button
                    onclick="deleteAlertRule('${rule.id}')">

                    Remover

                </button>

            `;

            alertRulesList.appendChild(div);

        });

    } catch (error) {

        console.error(
            'Erro regras:',
            error
        );

    }

}

async function createAlertRule(event) {

    event.preventDefault();

    try {

        await fetch(

            'http://localhost:3000/metrics/alert-rules',

            {
                method: 'POST',

                headers: {

                    'Content-Type':
                        'application/json',

                    Authorization:
                        `Bearer ${authToken}`

                },

                body: JSON.stringify({

                    name:
                        alertRuleName.value,

                    server_id:
                        alertRuleServer.value,

                    metric_name:
                        alertRuleMetric.value,

                    operator:
                        alertRuleOperator.value,

                    threshold:
                        alertRuleThreshold.value,

                    duration_seconds:
                        alertRuleDuration.value

                })

            }

        );

        alertRuleForm.reset();

        await loadAlertRules();

    } catch (error) {

        console.error(
            'Erro criar regra:',
            error
        );

    }

}

async function deleteAlertRule(id) {

    try {

        await fetch(

            `http://localhost:3000/metrics/alert-rules/${id}`,

            {
                method: 'DELETE',

                headers: {
                    Authorization:
                        `Bearer ${authToken}`
                }
            }

        );

        await loadAlertRules();

    } catch (error) {

        console.error(
            'Erro remover regra:',
            error
        );

    }

}

function populateServerSelects(servers) {

    const selects = [

        serverFilter,

        dashboardServerFilter,

        alertServerFilter,

        alertRuleServer

    ];

    selects.forEach(select => {

        if (!select) return;

        const currentValue =
            select.value || 'all';

        select.innerHTML =
            '<option value="all">Todos os servidores</option>';

        servers.forEach(server => {

            const option =
                document.createElement('option');

            option.value =
                server.id;

            option.textContent =
                server.name ||
                server.hostname;

            select.appendChild(option);

        });

        select.value =
            currentValue;

    });

}

async function loadServers() {

    try {

        const response =
            await fetch(

                'http://localhost:3000/metrics/servers',

                {
                    headers: {
                        Authorization:
                            `Bearer ${authToken}`
                    }
                }

            );

        const servers =
            await response.json();

        populateServerSelects(
            servers
        );

        serversGrid.innerHTML = '';

        servers.forEach(server => {

            const div =
                document.createElement('div');

            div.classList.add(
                'server-card'
            );

            div.innerHTML = `

                <div class="server-card-header">

                    <h3>
                        ${server.name}
                    </h3>

                    <span class="${
                        server.online
                            ? 'status-online'
                            : 'status-offline'
                    }">

                        ${
                            server.online
                                ? 'Online'
                                : 'Offline'
                        }

                    </span>

                </div>

                <p>
                    Hostname:
                    ${server.hostname}
                </p>

                <p>
                    IP:
                    ${server.ip_address || '-'}
                </p>

                <p>
                    Uptime:
                    ${server.uptime_percent || 0}%
                </p>

                <p>
                    Último heartbeat:
                    ${
                        server.last_heartbeat_at
                            ? new Date(
                                server.last_heartbeat_at
                            ).toLocaleString()
                            : 'Nunca'
                    }
                </p>

                <p>
                    Última métrica:
                    ${
                        server.last_metric_at
                            ? new Date(
                                server.last_metric_at
                            ).toLocaleString()
                            : 'Nunca'
                    }
                </p>

            `;

            serversGrid.appendChild(div);

        });

    } catch (error) {

        console.error(
            'Erro servidores:',
            error
        );

    }

}

async function refreshDashboard() {

    await loadServers();

    await loadMetrics();

    await loadHistory();

    await loadAlerts();

    await loadLogs();

    await loadAlertRules();

}

refreshDashboard();

setInterval(loadMetrics, 5000);

setInterval(loadServers, 10000);

socket.on('metrics-update', data => {

    const selectedDashboardServer =
        getSelectedDashboardServer();

    if (

        selectedDashboardServer !== 'all' &&

        data.server_id !==
        selectedDashboardServer

    ) {

        return;

    }

    cpuElement.innerText =
        data.cpu + '%';

    memoryElement.innerText =
        data.memory + '%';

    diskElement.innerText =
        data.disk + '%';

    cpuBar.style.width =
        data.cpu + '%';

    memoryBar.style.width =
        data.memory + '%';

    diskBar.style.width =
        data.disk + '%';

    const now =
        new Date().toLocaleTimeString();

    cpuChart.data.labels.push(now);

    cpuChart.data.datasets[0].data.push(
        data.cpu
    );

    memoryChart.data.labels.push(now);

    memoryChart.data.datasets[0].data.push(
        data.memory
    );

    if (
        cpuChart.data.labels.length > 15
    ) {

        cpuChart.data.labels.shift();

        cpuChart.data.datasets[0].data.shift();

    }

    if (
        memoryChart.data.labels.length > 15
    ) {

        memoryChart.data.labels.shift();

        memoryChart.data.datasets[0].data.shift();

    }

    cpuChart.update();

    memoryChart.update();

    loadAlerts();

});

socket.on('new-log', log => {

    addLogToUI(log);

});

socket.on('new-alert', () => {

    loadAlerts();

});

const menuItems =
    document.querySelectorAll('.menu-item');

const sections =
    document.querySelectorAll('.content-section');

menuItems.forEach(item => {

    item.addEventListener('click', () => {

        menuItems.forEach(menu => {

            menu.classList.remove(
                'active'
            );

        });

        sections.forEach(section => {

            section.classList.remove(
                'active-section'
            );

        });

        item.classList.add('active');

        const sectionId =
            item.dataset.section;

        document
            .getElementById(sectionId)
            .classList.add(
                'active-section'
            );

    });

});

if (periodFilter) {

    periodFilter.addEventListener(
        'change',
        () => {

            if (
                periodFilter.value ===
                'custom'
            ) {

                customFilter.classList.remove(
                    'hidden'
                );

            } else {

                customFilter.classList.add(
                    'hidden'
                );

                loadHistory();

            }

        }
    );

}

if (applyCustomFilterButton) {

    applyCustomFilterButton
        .addEventListener(
            'click',
            () => {

                loadHistory();

            }
        );

}

if (serverFilter) {

    serverFilter.addEventListener(
        'change',
        () => {

            loadHistory();

        }
    );

}

if (dashboardServerFilter) {

    dashboardServerFilter
        .addEventListener(
            'change',
            () => {

                loadMetrics();

                loadHistory();

            }
        );

}

if (alertServerFilter) {

    alertServerFilter
        .addEventListener(
            'change',
            () => {

                loadAlerts();

            }
        );

}

if (alertRuleForm) {

    alertRuleForm.addEventListener(
        'submit',
        createAlertRule
    );

}

if (userRole !== 'admin') {

    document
        .querySelectorAll('.admin-only')
        .forEach(el => {

            el.style.display = 'none';

        });

}

function logout() {

    localStorage.removeItem('token');

    localStorage.removeItem('username');

    localStorage.removeItem('role');

    window.location.href =
        'login.html';

}