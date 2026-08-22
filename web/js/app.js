// ----------------------------------------------------
// CORE PILATES STUDIO SCHEDULER - JS LOGIC (ES6)
// ----------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    // --- Estado de la SPA ---
    let roleMode = "admin"; // 'admin' o 'student'
    let selectedStudentId = null;
    let currentWeekMonday = getMondayOfCurrentWeek(new Date());
    let students = [];
    let agenda = [];
    let templates = [];
    let selectedClass = null; // Instancia de clase abierta en modal

    // --- Selectores del DOM ---
    const cardSelectStudent = document.getElementById("card-select-student");
    const cardSelectAdmin = document.getElementById("card-select-admin");
    const landingPage = document.getElementById("landing-page");
    const appDashboard = document.getElementById("app-dashboard");
    const currentRoleBadge = document.getElementById("current-role-badge");
    const btnLogout = document.getElementById("btn-logout");
    const studentSelectorBox = document.getElementById("student-selector-box");
    const studentSelect = document.getElementById("student-select");
    const studentCreditsVal = document.getElementById("student-credits-val");
    
    const menuAgenda = document.getElementById("menu-agenda");
    const menuStudents = document.getElementById("menu-students");
    const tabAgendaContent = document.getElementById("tab-agenda-content");
    const tabStudentsContent = document.getElementById("tab-students-content");
    
    const weekRangeLabel = document.getElementById("week-range-label");
    const btnPrevWeek = document.getElementById("btn-prev-week");
    const btnNextWeek = document.getElementById("btn-next-week");
    const agendaContainer = document.getElementById("agenda-container");
    
    const newStudentForm = document.getElementById("new-student-form");
    const studentsTableBody = document.getElementById("students-table-body");
    
    // Selectores del Modal Detalle
    const classDetailModal = document.getElementById("class-detail-modal");
    const modalTabBtns = document.querySelectorAll(".modal-tab-btn");
    const modalTabContents = document.querySelectorAll(".modal-tab-content");
    const modalFixedList = document.getElementById("modal-fixed-list");
    const modalRecoveryList = document.getElementById("modal-recovery-list");
    const modalAbsentList = document.getElementById("modal-absent-list");
    const adminRecoveryStudentSelect = document.getElementById("admin-recovery-student-select");
    const btnAdminSubmitRecovery = document.getElementById("btn-admin-submit-recovery");
    const assignStudentSelect = document.getElementById("assign-student-select");
    const assignFixedForm = document.getElementById("assign-fixed-form");

    // ----------------------------------------------------
    // Notificaciones Toasts
    // ----------------------------------------------------
    function showToast(message, type = "info") {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        let icon = "fa-circle-info";
        if (type === "success") icon = "fa-circle-check";
        if (type === "error") icon = "fa-triangle-exclamation";
        
        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(50px)";
            toast.style.transition = "all 0.4s ease";
            setTimeout(() => { toast.remove(); }, 400);
        }, 4000);
    }

    // ----------------------------------------------------
    // Navegación de Fechas (Semanal)
    // ----------------------------------------------------
    function getMondayOfCurrentWeek(d) {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar si es Domingo
        const monday = new Date(d.setDate(diff));
        monday.setHours(0,0,0,0);
        return monday;
    }

    function formatDateRangeLabel() {
        const friday = new Date(currentWeekMonday);
        friday.setDate(friday.getDate() + 4);
        
        const options = { day: '2-digit', month: 'short' };
        const startStr = currentWeekMonday.toLocaleDateString('es-AR', options);
        const endStr = friday.toLocaleDateString('es-AR', options);
        const year = currentWeekMonday.getFullYear();
        
        weekRangeLabel.textContent = `${startStr} - ${endStr} (${year})`;
    }

    btnPrevWeek.addEventListener("click", () => {
        currentWeekMonday.setDate(currentWeekMonday.getDate() - 7);
        formatDateRangeLabel();
        loadAgenda();
        if (roleMode === "student" && selectedStudentId) {
            loadStudentCredits();
            loadStudentPaymentStatus();
        }
    });

    btnNextWeek.addEventListener("click", () => {
        currentWeekMonday.setDate(currentWeekMonday.getDate() + 7);
        formatDateRangeLabel();
        loadAgenda();
        if (roleMode === "student" && selectedStudentId) {
            loadStudentCredits();
            loadStudentPaymentStatus();
        }
    });

    // ----------------------------------------------------
    // Control de Roles (Landing Page & Salida)
    // ----------------------------------------------------
    function setRole(mode) {
        roleMode = mode;
        document.body.className = roleMode === "admin" ? "dark-mode mode-admin" : "dark-mode";
        
        // Asegurar que el banner de advertencia esté oculto al cambiar de rol
        document.getElementById("unpaid-warning-banner")?.classList.add("hidden");
        
        if (roleMode === "admin") {
            currentRoleBadge.className = "user-role-badge badge-admin";
            const savedUser = localStorage.getItem("currentUser");
            const adminName = savedUser ? JSON.parse(savedUser).name : "Administrador";
            currentRoleBadge.innerHTML = `<i class="fa-solid fa-user-gear"></i> <span>${adminName}</span>`;
            
            studentSelectorBox.style.display = "none";
            studentSelect.style.display = "block"; // Restaurar por si cambia
            document.querySelectorAll("[data-admin-only='true']").forEach(el => el.classList.remove("hidden"));
            showTab("agenda");
        } else {
            currentRoleBadge.className = "user-role-badge badge-student";
            const savedUser = localStorage.getItem("currentUser");
            const studentName = savedUser ? JSON.parse(savedUser).name : "Alumno";
            currentRoleBadge.innerHTML = `<i class="fa-solid fa-child-reaching"></i> <span>${studentName}</span>`;
            
            studentSelectorBox.style.display = "flex";
            studentSelect.style.display = "none"; // Ocultar para privacidad entre alumnos
            document.querySelectorAll("[data-admin-only='true']").forEach(el => el.classList.add("hidden"));
            showTab("agenda");
            if (savedUser) {
                selectedStudentId = JSON.parse(savedUser).id;
                loadStudentCredits();
                loadStudentPaymentStatus();
            }
        }
        renderAgenda();
        
        // Ocultar landing page con transición y mostrar dashboard
        landingPage.classList.add("fade-out");
        appDashboard.classList.remove("hidden");
    }

    // Selectores del Login Form
    const landingRoleCards = document.getElementById("landing-role-cards");
    const loginFormBox = document.getElementById("login-form-box");
    const btnLoginBack = document.getElementById("btn-login-back");
    const formAuthLogin = document.getElementById("form-auth-login");
    const loginUsernameInput = document.getElementById("login-username");
    const loginPasswordInput = document.getElementById("login-password");
    const loginTitle = document.getElementById("login-title");
    let selectedLoginRole = null;

    function showLoginForm(role) {
        selectedLoginRole = role;
        loginTitle.textContent = role === "admin" ? "Ingreso Administrador" : "Ingreso Alumno";
        loginUsernameInput.value = "";
        loginPasswordInput.value = "";
        landingRoleCards.classList.add("hidden");
        loginFormBox.classList.remove("hidden");
    }

    function hideLoginForm() {
        loginFormBox.classList.add("hidden");
        landingRoleCards.classList.remove("hidden");
    }

    cardSelectStudent.addEventListener("click", () => {
        showLoginForm("student");
    });

    cardSelectAdmin.addEventListener("click", () => {
        showLoginForm("admin");
    });

    if (btnLoginBack) {
        btnLoginBack.addEventListener("click", hideLoginForm);
    }

    if (formAuthLogin) {
        formAuthLogin.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = loginUsernameInput.value;
            const password = loginPasswordInput.value;
            
            try {
                const response = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password, role: selectedLoginRole })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    showToast(`¡Bienvenido, ${data.name}!`, "success");
                    localStorage.setItem("currentUser", JSON.stringify({
                        id: data.id,
                        name: data.name,
                        username: data.username,
                        role: data.role
                    }));
                    hideLoginForm();
                    setRole(data.role);
                } else {
                    const err = await response.json();
                    showToast(err.detail || "Usuario o contraseña incorrectos.", "error");
                }
            } catch (err) {
                showToast("Error de conexión al servidor.", "error");
            }
        });
    }

    btnLogout.addEventListener("click", () => {
        // Cerrar sesión
        localStorage.removeItem("currentUser");
        selectedStudentId = null;
        appDashboard.classList.add("hidden");
        landingPage.classList.remove("fade-out");
        hideLoginForm();
    });

    studentSelect.addEventListener("change", (e) => {
        selectedStudentId = parseInt(e.target.value);
        loadStudentCredits();
        renderAgenda();
    });

    async function loadStudentCredits() {
        if (!selectedStudentId) return;
        const formattedDate = currentWeekMonday.toISOString().split("T")[0];
        try {
            const response = await fetch(`/api/students/${selectedStudentId}/credits?query_date=${formattedDate}`);
            if (response.ok) {
                const credits = await response.json();
                studentCreditsVal.textContent = credits.credits_available;
            }
        } catch (e) {
            console.error("Error al cargar créditos del alumno:", e);
        }
    }

    // ----------------------------------------------------
    // Navegación por Pestañas
    // ----------------------------------------------------
    function showTab(tabName) {
        document.querySelectorAll(".header-menu .menu-item, .sidebar-menu .menu-item").forEach(item => item.classList.remove("active"));
        tabAgendaContent.classList.add("hidden");
        tabStudentsContent.classList.add("hidden");
        document.getElementById("tab-payments-content").classList.add("hidden");

        if (tabName === "agenda") {
            menuAgenda.classList.add("active");
            tabAgendaContent.classList.remove("hidden");
        } else if (tabName === "students") {
            menuStudents.classList.add("active");
            tabStudentsContent.classList.remove("hidden");
            loadStudentsTable();
        } else if (tabName === "payments") {
            document.getElementById("menu-payments").classList.add("active");
            document.getElementById("tab-payments-content").classList.remove("hidden");
            loadPaymentsPanel();
        }
    }

    menuAgenda.addEventListener("click", (e) => { e.preventDefault(); showTab("agenda"); });
    menuStudents.addEventListener("click", (e) => { e.preventDefault(); showTab("students"); });
    
    const menuPayments = document.getElementById("menu-payments");
    if (menuPayments) {
        menuPayments.addEventListener("click", (e) => { e.preventDefault(); showTab("payments"); });
    }

    // ----------------------------------------------------
    // Conexión con la API (Carga de Datos)
    // ----------------------------------------------------
    async function loadStudents() {
        try {
            const response = await fetch("/api/students");
            students = await response.json();
            
            // Cargar en el selector de Alumno de la sidebar
            studentSelect.innerHTML = students.map(s => `
                <option value="${s.id}">${s.name}</option>
            `).join("");

            // Cargar en los selectores del Modal
            adminRecoveryStudentSelect.innerHTML = '<option value="">Seleccione alumno...</option>' + 
                students.map(s => `<option value="${s.id}">${s.name} (créditos: ${s.recovery_credits})</option>`).join("");
                
            assignStudentSelect.innerHTML = '<option value="">Seleccione alumno...</option>' + 
                students.map(s => `<option value="${s.id}">${s.name}</option>`).join("");

            if (students.length > 0 && !selectedStudentId) {
                selectedStudentId = students[0].id;
            }
        } catch (e) {
            console.error("Error al cargar alumnos:", e);
            showToast("No se pudo cargar el listado de alumnos.", "error");
        }
    }

    async function loadAgenda() {
        const formattedDate = currentWeekMonday.toISOString().split("T")[0];
        try {
            let url = `/api/agenda?start_date=${formattedDate}`;
            if (roleMode === "student" && selectedStudentId) {
                url += `&student_id=${selectedStudentId}`;
            }
            const response = await fetch(url);
            if (response.ok) {
                agenda = await response.json();
                renderAgenda();
            }
        } catch (e) {
            console.error("Error al cargar la agenda:", e);
            showToast("No se pudo cargar la agenda semanal.", "error");
        }
    }

    // ----------------------------------------------------
    // Renderizado de la Agenda Semanal
    // ----------------------------------------------------
    function renderAgenda() {
        agendaContainer.innerHTML = "";
        
        agenda.forEach(day => {
            const column = document.createElement("div");
            
            // Verificar si es el día de hoy
            const isToday = new Date().toDateString() === new Date(day.date).toDateString();
            column.className = `agenda-column ${isToday ? 'today' : ''}`;
            
            // Convertir fecha de YYYY-MM-DD a DD/MM
            const dateParts = day.date.split("-");
            const dateFormatted = `${dateParts[2]}/${dateParts[1]}`;

            column.innerHTML = `
                <div class="column-header">
                    <h3>${day.day_name}</h3>
                    <span>${dateFormatted}</span>
                </div>
                <div class="class-slots-list">
                    <!-- Turnos -->
                </div>
            `;
            
            const slotsList = column.querySelector(".class-slots-list");
            
            day.classes.forEach(cls => {
                const card = createClassSlotCard(cls);
                slotsList.appendChild(card);
            });
            
            agendaContainer.appendChild(column);
        });
    }

    function createClassSlotCard(cls) {
        const card = document.createElement("div");
        
        // Estilo de barra de progreso y ocupación
        const percent = (cls.occupied_count / cls.max_capacity) * 100;
        let capacityClass = "slots-free";
        if (cls.occupied_count >= cls.max_capacity) {
            capacityClass = "slots-full";
        } else if (cls.occupied_count >= 6) {
            capacityClass = "slots-filling";
        }
        
        card.className = `class-slot-card ${capacityClass}`;
        
        // Renderizado del contenido interno
        card.innerHTML = `
            <div class="slot-time">${cls.time} hs</div>
            <div class="slot-occupancy">
                <span><span class="occupancy-dot"></span> Ocupado: ${cls.occupied_count}/${cls.max_capacity}</span>
            </div>
            <div class="mini-progress-bar">
                <div class="mini-progress-fill" style="width: ${percent}%;"></div>
            </div>
            <div class="slot-student-badges">
                <!-- Badges de los alumnos confirmados, ausentes o recuperaciones -->
            </div>
            <div class="slot-actions">
                <!-- Botones contextuales en modo Alumno -->
            </div>
        `;

        const badgesContainer = card.querySelector(".slot-student-badges");
        const actionsContainer = card.querySelector(".slot-actions");

        // Rellenar badges según lo que corresponda y según el rol (Privacidad)
        if (roleMode === "admin") {
            cls.fixed_students.forEach(s => {
                badgesContainer.innerHTML += `<span class="badge-tag fixed" title="${s.email}">${s.name}</span>`;
            });
            cls.recovery_students.forEach(s => {
                badgesContainer.innerHTML += `<span class="badge-tag recovery" title="${s.email} - Recuperación">${s.name}</span>`;
            });
            cls.absent_students.forEach(s => {
                badgesContainer.innerHTML += `<span class="badge-tag absence" title="${s.email} - Ausente">${s.name}</span>`;
            });
        } else {
            // Estudiante sólo ve su propio estado en esta clase
            const isFixed = cls.fixed_students.some(s => s.id === selectedStudentId);
            const isAbsent = cls.absent_students.some(s => s.id === selectedStudentId);
            const isRecovery = cls.recovery_students.some(s => s.id === selectedStudentId);
            
            if (isFixed && !isAbsent) {
                badgesContainer.innerHTML += `<span class="badge-tag fixed">Mi Turno Fijo</span>`;
            } else if (isFixed && isAbsent) {
                badgesContainer.innerHTML += `<span class="badge-tag absence">Falta Reportada</span>`;
            } else if (isRecovery) {
                badgesContainer.innerHTML += `<span class="badge-tag recovery">Mi Recuperación</span>`;
            }
        }

        // Eventos y controles por Rol
        if (roleMode === "admin") {
            card.addEventListener("click", () => openClassDetailModal(cls));
        } else {
            // --- MODO ALUMNO ---
            const isFixed = cls.fixed_students.some(s => s.id === selectedStudentId);
            const isAbsent = cls.absent_students.some(s => s.id === selectedStudentId);
            const isRecovery = cls.recovery_students.some(s => s.id === selectedStudentId);
            
            if (isFixed && !isAbsent) {
                // Alumno fijo activo -> Puede liberar
                const btn = document.createElement("button");
                btn.className = "btn btn-danger btn-sm";
                btn.textContent = "Liberar mi lugar";
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    actionReleaseSpot(selectedStudentId, cls.class_template_id, cls.date);
                });
                actionsContainer.appendChild(btn);
            } 
            else if (isFixed && isAbsent) {
                // Alumno fijo ausente -> Puede cancelar inasistencia (asistir) si hay cupo
                const btn = document.createElement("button");
                btn.className = "btn btn-secondary btn-sm";
                btn.textContent = "Volver a Asistir";
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    actionCancelAbsence(selectedStudentId, cls.class_template_id, cls.date);
                });
                actionsContainer.appendChild(btn);
            }
            else if (isRecovery) {
                // Alumno en recuperación -> Puede cancelar la recuperación
                const btn = document.createElement("button");
                btn.className = "btn btn-danger btn-sm";
                btn.textContent = "Cancelar Recuperación";
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    actionCancelRecovery(selectedStudentId, cls.class_template_id, cls.date);
                });
                actionsContainer.appendChild(btn);
            }
            else {
                // Alumno externo -> Puede recuperar si hay créditos y cupo
                const credits = parseInt(studentCreditsVal.textContent) || 0;
                const hasSpots = cls.available_spots > 0;
                
                const btn = document.createElement("button");
                btn.className = "btn btn-primary btn-sm";
                btn.textContent = "Recuperar aquí";
                
                if (credits <= 0 || !hasSpots) {
                    btn.disabled = true;
                    btn.className = "btn btn-secondary btn-sm";
                    btn.title = credits <= 0 ? "No tienes créditos este mes" : "Clase completa";
                }
                
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    actionBookRecovery(selectedStudentId, cls.class_template_id, cls.date);
                });
                actionsContainer.appendChild(btn);
            }
        }

        return card;
    }

    // ----------------------------------------------------
    // Acciones del Alumno (API calls)
    // ----------------------------------------------------
    async function actionReleaseSpot(studentId, classTemplateId, dateStr) {
        try {
            const response = await fetch("/api/bookings/release", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ student_id: studentId, class_template_id: classTemplateId, date: dateStr })
            });
            if (response.ok) {
                showToast("¡Lugar liberado! Has ganado 1 crédito de recuperación para este mes.", "success");
                refreshAll();
            } else {
                const err = await response.json();
                showToast(err.detail || "Error al liberar cupo.", "error");
            }
        } catch (e) {
            showToast("Error de conexión.", "error");
        }
    }

    async function actionBookRecovery(studentId, classTemplateId, dateStr) {
        try {
            const response = await fetch("/api/bookings/recover", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ student_id: studentId, class_template_id: classTemplateId, date: dateStr })
            });
            if (response.ok) {
                showToast("Clase de recuperación reservada correctamente.", "success");
                refreshAll();
            } else {
                const err = await response.json();
                showToast(err.detail || "Error al agendar recuperación.", "error");
            }
        } catch (e) {
            showToast("Error de conexión.", "error");
        }
    }

    async function actionCancelAbsence(studentId, classTemplateId, dateStr) {
        try {
            const response = await fetch("/api/bookings/cancel-absence", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ student_id: studentId, class_template_id: classTemplateId, date: dateStr })
            });
            if (response.ok) {
                showToast("Se canceló el aviso de falta. Has regresado a tu turno fijo.", "success");
                refreshAll();
            } else {
                const err = await response.json();
                showToast(err.detail || "Error al reintegrarse.", "error");
            }
        } catch (e) {
            showToast("Error de conexión.", "error");
        }
    }

    async function actionCancelRecovery(studentId, classTemplateId, dateStr) {
        try {
            const response = await fetch("/api/bookings/cancel-recovery", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ student_id: studentId, class_template_id: classTemplateId, date: dateStr })
            });
            if (response.ok) {
                showToast("Recuperación cancelada. El crédito ha sido restituido.", "success");
                refreshAll();
            } else {
                const err = await response.json();
                showToast(err.detail || "Error al cancelar la recuperación.", "error");
            }
        } catch (e) {
            showToast("Error de conexión.", "error");
        }
    }

    function refreshAll() {
        loadStudents().then(() => {
            loadAgenda();
            if (roleMode === "student") {
                loadStudentCredits();
            }
        });
    }

    // ----------------------------------------------------
    // Modal de Detalle (Administrador)
    // ----------------------------------------------------
    function openClassDetailModal(cls) {
        selectedClass = cls;
        classDetailModal.classList.remove("hidden");
        
        // Pestaña por defecto
        modalTabBtns[0].click();
        
        // Cargar metadatos
        const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
        document.getElementById("modal-class-day").textContent = dayNames[cls.day_of_week];
        
        const dateObj = new Date(cls.date);
        document.getElementById("modal-class-date").textContent = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
        document.getElementById("modal-class-time").textContent = `${cls.time} hs`;
        document.getElementById("modal-class-occupancy").textContent = `${cls.occupied_count} / ${cls.max_capacity} alumnos`;
        
        const percent = (cls.occupied_count / cls.max_capacity) * 100;
        document.getElementById("modal-capacity-fill").style.width = `${percent}%`;

        // Renderizar listas en el modal
        renderModalAttendeesLists();
    }

    function renderModalAttendeesLists() {
        const cls = selectedClass;
        
        // 1. Alumnos Fijos
        if (cls.fixed_students.length === 0) {
            modalFixedList.innerHTML = "<li class='text-muted'>Sin alumnos fijos asignados</li>";
        } else {
            modalFixedList.innerHTML = cls.fixed_students.map(s => `
                <li>
                    <div class="student-info">
                        <span class="student-name">${s.name}</span>
                        <span class="student-email">${s.email}</span>
                    </div>
                    <button class="btn btn-danger btn-sm btn-modal-absence" data-student-id="${s.id}">Marcar Falta</button>
                </li>
            `).join("");
            
            // Enlazar eventos para marcar falta
            modalFixedList.querySelectorAll(".btn-modal-absence").forEach(btn => {
                btn.addEventListener("click", () => {
                    const studentId = parseInt(btn.getAttribute("data-student-id"));
                    actionReleaseSpot(studentId, cls.class_template_id, cls.date).then(() => {
                        // Refrescar modal localmente
                        updateSelectedClassState().then(openClassDetailModal);
                    });
                });
            });
        }

        // 2. Alumnos de Recuperación
        if (cls.recovery_students.length === 0) {
            modalRecoveryList.innerHTML = "<li class='text-muted'>Sin recuperaciones en esta fecha</li>";
        } else {
            modalRecoveryList.innerHTML = cls.recovery_students.map(s => `
                <li>
                    <div class="student-info">
                        <span class="student-name">${s.name}</span>
                        <span class="student-email">${s.email}</span>
                    </div>
                    <button class="btn btn-danger btn-sm btn-modal-cancel-rec" data-student-id="${s.id}">Quitar</button>
                </li>
            `).join("");
            
            // Enlazar eventos para quitar recuperación
            modalRecoveryList.querySelectorAll(".btn-modal-cancel-rec").forEach(btn => {
                btn.addEventListener("click", () => {
                    const studentId = parseInt(btn.getAttribute("data-student-id"));
                    actionCancelRecovery(studentId, cls.class_template_id, cls.date).then(() => {
                        updateSelectedClassState().then(openClassDetailModal);
                    });
                });
            });
        }

        // 3. Alumnos Ausentes (liberaron turno)
        if (cls.absent_students.length === 0) {
            modalAbsentList.innerHTML = "<li class='text-muted'>Sin ausencias reportadas hoy</li>";
        } else {
            modalAbsentList.innerHTML = cls.absent_students.map(s => `
                <li>
                    <div class="student-info">
                        <span class="student-name">${s.name}</span>
                        <span class="student-email">${s.email}</span>
                    </div>
                    <button class="btn btn-success btn-sm btn-modal-restore-absence" data-student-id="${s.id}">Restaurar</button>
                </li>
            `).join("");
            
            // Enlazar eventos para cancelar ausencia
            modalAbsentList.querySelectorAll(".btn-modal-restore-absence").forEach(btn => {
                btn.addEventListener("click", () => {
                    const studentId = parseInt(btn.getAttribute("data-student-id"));
                    actionCancelAbsence(studentId, cls.class_template_id, cls.date).then(() => {
                        updateSelectedClassState().then(openClassDetailModal);
                    });
                });
            });
        }
    }

    async function updateSelectedClassState() {
        // Consultar el estado más fresco del backend
        const formattedDate = currentWeekMonday.toISOString().split("T")[0];
        const res = await fetch(`/api/agenda?start_date=${formattedDate}`);
        const data = await res.json();
        agenda = data;
        renderAgenda();
        
        // Encontrar la instancia en la nueva agenda
        for (const day of agenda) {
            const found = day.classes.find(c => c.class_template_id === selectedClass.class_template_id && c.date === selectedClass.date);
            if (found) {
                selectedClass = found;
                break;
            }
        }
        return selectedClass;
    }

    // Modal Tabs logic
    modalTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            modalTabBtns.forEach(b => b.classList.remove("active"));
            modalTabContents.forEach(c => c.classList.add("hidden"));
            
            btn.classList.add("active");
            const targetId = btn.getAttribute("data-modal-tab");
            document.getElementById(targetId).classList.remove("hidden");
        });
    });

    // Cerrar modales
    document.querySelectorAll(".modal-close-trigger").forEach(btn => {
        btn.addEventListener("click", () => {
            classDetailModal.classList.add("hidden");
            selectedClass = null;
        });
    });

    // Registrar Recuperación Manual (Admin)
    btnAdminSubmitRecovery.addEventListener("click", async () => {
        const studentId = parseInt(adminRecoveryStudentSelect.value);
        if (!studentId) {
            showToast("Por favor, seleccione un alumno.", "error");
            return;
        }
        
        btnAdminSubmitRecovery.disabled = true;
        try {
            const response = await fetch("/api/bookings/recover", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_id: studentId,
                    class_template_id: selectedClass.class_template_id,
                    date: selectedClass.date
                })
            });
            
            if (response.ok) {
                showToast("Recuperación registrada con éxito.", "success");
                adminRecoveryStudentSelect.value = "";
                await updateSelectedClassState();
                openClassDetailModal(selectedClass);
            } else {
                const err = await response.json();
                showToast(err.detail || "Error al agendar recuperación.", "error");
            }
        } catch (e) {
            showToast("Error de conexión.", "error");
        } finally {
            btnAdminSubmitRecovery.disabled = false;
        }
    });

    // Asignar Horario Fijo (Admin)
    assignFixedForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const studentId = parseInt(assignStudentSelect.value);
        if (!studentId) return;
        
        try {
            const response = await fetch("/api/schedules/assign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_id: studentId,
                    class_template_id: selectedClass.class_template_id
                })
            });
            
            if (response.ok) {
                showToast("Horario fijo asignado al alumno correctamente.", "success");
                assignStudentSelect.value = "";
                await updateSelectedClassState();
                openClassDetailModal(selectedClass);
            } else {
                const err = await response.json();
                showToast(err.detail || "Error al asignar horario fijo.", "error");
            }
        } catch (err) {
            showToast("Error de conexión.", "error");
        }
    });

    // ----------------------------------------------------
    // Pestaña Alumnos (Crear / Eliminar) y Configuración de Turnos - Admin Only
    // ----------------------------------------------------
    async function loadTemplates() {
        try {
            const response = await fetch("/api/templates");
            templates = await response.json();
            
            // Recargar también los selectores del modal de asignación y recuperaciones
            adminRecoveryStudentSelect.innerHTML = '<option value="">Seleccione alumno...</option>' + 
                students.map(s => `<option value="${s.id}">${s.name} (créditos: ${s.recovery_credits})</option>`).join("");
                
            assignStudentSelect.innerHTML = '<option value="">Seleccione alumno...</option>' + 
                students.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
                
            // Populate the new student form templates checkboxes
            const checkboxesContainer = document.getElementById("st-templates-checkboxes");
            if (checkboxesContainer) {
                const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
                if (templates.length === 0) {
                    checkboxesContainer.innerHTML = '<span class="text-muted" style="font-size: 0.85rem;">No hay turnos creados</span>';
                } else {
                    checkboxesContainer.innerHTML = templates.map(t => `
                        <label style="display: flex; align-items: center; gap: 10px; font-size: 0.85rem; cursor: pointer; text-transform: none; margin-bottom: 0;">
                            <input type="checkbox" value="${t.id}" class="st-template-checkbox" style="width: auto; height: auto; cursor: pointer;">
                            <span>${dayNames[t.day_of_week]} - ${t.time} hs</span>
                        </label>
                    `).join("");
                }
            }
                
            renderActiveTemplatesList();
        } catch (e) {
            console.error("Error al cargar plantillas:", e);
        }
    }

    function renderActiveTemplatesList() {
        const activeTemplatesList = document.getElementById("active-templates-list");
        if (!activeTemplatesList) return;
        
        const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
        
        if (templates.length === 0) {
            activeTemplatesList.innerHTML = "<li class='text-muted' style='justify-content: center;'>No hay turnos creados</li>";
            return;
        }
        
        activeTemplatesList.innerHTML = templates.map(t => {
            const dayName = dayNames[t.day_of_week] || "Desconocido";
            return `
                <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;">
                    <div>
                        <strong style="color: var(--color-primary);">${dayName}</strong> 
                        <span style="margin-left: 5px;">${t.time} hs</span>
                        <small style="display: block; color: var(--text-muted); font-size: 0.75rem;">Capacidad: ${t.max_capacity} alumnos</small>
                    </div>
                    <button class="btn btn-danger btn-sm btn-delete-template" data-id="${t.id}" style="width: auto; padding: 4px 8px; font-size: 0.8rem; border-color: transparent;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </li>
            `;
        }).join("");
        
        // Asignar listeners para eliminar turnos
        activeTemplatesList.querySelectorAll(".btn-delete-template").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = parseInt(btn.getAttribute("data-id"));
                const template = templates.find(t => t.id === id);
                const dayName = template ? dayNames[template.day_of_week] : "Día";
                const timeStr = template ? template.time : "";
                
                if (confirm(`¿Estás seguro de eliminar el turno del ${dayName} a las ${timeStr} hs?\nSe eliminarán todos los horarios fijos y reservas asociados a este turno.`)) {
                    try {
                        const response = await fetch(`/api/templates/${id}`, { method: "DELETE" });
                        if (response.ok) {
                            showToast("Turno semanal eliminado con éxito.", "success");
                            // Recargar todo
                            await loadTemplates();
                            await loadAgenda();
                            if (!tabStudentsContent.classList.contains("hidden")) {
                                loadStudentsTable();
                            }
                        } else {
                            const err = await response.json();
                            showToast(err.detail || "Error al eliminar turno.", "error");
                        }
                    } catch (err) {
                        showToast("Error de conexión.", "error");
                    }
                }
            });
        });
    }

    async function loadStudentsTable() {
        try {
            // Asegurarnos de tener turnos y alumnos frescos
            await loadTemplates();
            await loadStudents();
            renderStudentsTable();
        } catch (e) {
            console.error("Error al cargar la tabla de alumnos:", e);
        }
    }

    function renderStudentsTable() {
        studentsTableBody.innerHTML = "";
        
        const searchQuery = (document.getElementById("search-students-input")?.value || "").toLowerCase().trim();
        const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
        
        students.forEach(s => {
            // Filtrar alumno por buscador
            if (searchQuery && !s.name.toLowerCase().includes(searchQuery) && !s.email.toLowerCase().includes(searchQuery)) {
                return;
            }
            
            const tr = document.createElement("tr");
            
            // Generar los chips de horarios fijos
            const fixedChips = (s.fixed_schedules || []).map(fs => `
                <span class="badge-tag fixed" style="display: inline-flex; align-items: center; gap: 5px; margin: 2px;">
                    ${fs.day_name} ${fs.time}
                    <i class="fa-solid fa-xmark btn-remove-schedule" 
                       data-student-id="${s.id}" 
                       data-template-id="${fs.class_template_id}" 
                       style="cursor: pointer; color: var(--color-danger); font-size: 0.8rem;" 
                       title="Quitar turno fijo"></i>
                </span>
            `).join("");
            
            // Generar el selector de turnos disponibles para asignación
            const selectOptions = templates.map(t => {
                const dayName = dayNames[t.day_of_week] || "Día";
                return `<option value="${t.id}">${dayName} - ${t.time} hs (Cap: ${t.max_capacity})</option>`;
            }).join("");
            
            // Obtener mes actual en formato YYYY-MM
            const now = new Date();
            const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            // Verificar si el alumno tiene pago registrado para el mes actual
            const hasPaidCurrentMonth = (s.payments || []).some(p => p.month === currentMonthStr);
            
            // Generar el badge de estado
            const paymentBadge = hasPaidCurrentMonth 
                ? `<span class="badge-payment paid">Pagado</span>` 
                : `<span class="badge-payment pending">Pendiente</span>`;

            tr.innerHTML = `
                <td><strong>${s.name}</strong></td>
                <td class="student-email-cell" title="${s.email}">${s.email}</td>
                <td><span class="badge badge-success">${s.recovery_credits}</span></td>
                <td>${paymentBadge}</td>
                <td>
                    <div class="student-fixed-chips-container">${fixedChips || '<span class="text-muted">Sin turnos asignados</span>'}</div>
                </td>
                <td>
                    <div class="assign-cell-container">
                        <select class="student-assign-select" data-student-id="${s.id}">
                            <option value="">Seleccionar...</option>
                            ${selectOptions}
                        </select>
                        <button class="btn btn-primary btn-sm btn-assign-student-schedule" data-student-id="${s.id}">
                            Asignar
                        </button>
                    </div>
                </td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-secondary btn-sm btn-pay-student" data-id="${s.id}" title="Registrar Pago">
                            <i class="fa-solid fa-credit-card" style="color: var(--color-success);"></i>
                        </button>
                        <button class="btn btn-secondary btn-sm btn-creds-student" data-id="${s.id}" title="Modificar Credenciales">
                            <i class="fa-solid fa-key"></i>
                        </button>
                        <button class="btn btn-danger btn-sm btn-delete-student" data-id="${s.id}" title="Eliminar Alumno">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            // Evento para credenciales
            tr.querySelector(".btn-creds-student").addEventListener("click", () => {
                openCredentialsModal(s.id, s.name, s.username);
            });

            // Evento para registrar pagos
            tr.querySelector(".btn-pay-student").addEventListener("click", () => {
                openPaymentsModal(s.id, s.name);
            });
            
            // 1. Evento para eliminar alumno
            tr.querySelector(".btn-delete-student").addEventListener("click", async () => {
                if (confirm(`¿Estás seguro de eliminar a ${s.name}? Se perderán sus horarios asignados y créditos.`)) {
                    const response = await fetch(`/api/students/${s.id}`, { method: "DELETE" });
                    if (response.ok) {
                        showToast("Alumno eliminado.", "success");
                        loadStudentsTable();
                    } else {
                        showToast("Error al eliminar alumno.", "error");
                    }
                }
            });
            
            // 2. Evento para remover turno fijo
            tr.querySelectorAll(".btn-remove-schedule").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const studentId = parseInt(btn.getAttribute("data-student-id"));
                    const templateId = parseInt(btn.getAttribute("data-template-id"));
                    
                    try {
                        const response = await fetch("/api/schedules/remove", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ student_id: studentId, class_template_id: templateId })
                        });
                        
                        if (response.ok) {
                            showToast("Horario fijo removido con éxito.", "success");
                            loadStudentsTable();
                            loadAgenda();
                        } else {
                            showToast("Error al remover horario fijo.", "error");
                        }
                    } catch (err) {
                        showToast("Error de conexión.", "error");
                    }
                });
            });
            
            // 3. Evento para asignar nuevo turno fijo
            tr.querySelector(".btn-assign-student-schedule").addEventListener("click", async () => {
                const studentId = s.id;
                const select = tr.querySelector(`.student-assign-select[data-student-id='${s.id}']`);
                const templateId = parseInt(select.value);
                
                if (!templateId) {
                    showToast("Selecciona un turno para asignar.", "error");
                    return;
                }
                
                try {
                    const response = await fetch("/api/schedules/assign", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ student_id: studentId, class_template_id: templateId })
                    });
                    
                    if (response.ok) {
                        showToast("Horario fijo asignado con éxito.", "success");
                        loadStudentsTable();
                        loadAgenda();
                    } else {
                        const err = await response.json();
                        showToast(err.detail || "Error al asignar horario.", "error");
                    }
                } catch (err) {
                    showToast("Error de conexión.", "error");
                }
            });
            
            studentsTableBody.appendChild(tr);
        });
    }

    // Listener para registrar nuevo alumno
    newStudentForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("st-name").value;
        const email = document.getElementById("st-email").value;
        const username = document.getElementById("st-username").value;
        const password = document.getElementById("st-password").value;
        
        // Get all checked template checkboxes
        const checkedBoxes = document.querySelectorAll(".st-template-checkbox:checked");
        const initial_class_template_ids = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
        
        try {
            const response = await fetch("/api/students", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, username, password, initial_class_template_ids })
            });
            
            if (response.ok) {
                showToast("Alumno registrado exitosamente.", "success");
                newStudentForm.reset();
                loadStudentsTable();
            } else {
                const err = await response.json();
                showToast(err.detail || "Error al registrar alumno.", "error");
            }
        } catch (err) {
            showToast("Error de conexión.", "error");
        }
    });

    // Listener para registrar nuevo turno semanal (ClassTemplate)
    const newTemplateForm = document.getElementById("new-template-form");
    if (newTemplateForm) {
        newTemplateForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const day_of_week = parseInt(document.getElementById("tmp-day").value);
            const time = document.getElementById("tmp-time").value;
            const max_capacity = parseInt(document.getElementById("tmp-capacity").value);
            
            try {
                const response = await fetch("/api/templates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ day_of_week, time, max_capacity })
                });
                
                if (response.ok) {
                    showToast("Turno semanal creado exitosamente.", "success");
                    newTemplateForm.reset();
                    await loadTemplates();
                    await loadAgenda();
                    if (!tabStudentsContent.classList.contains("hidden")) {
                        loadStudentsTable();
                    }
                } else {
                    const err = await response.json();
                    showToast(err.detail || "Error al crear el turno.", "error");
                }
            } catch (err) {
                showToast("Error de conexión.", "error");
            }
        });
    }

    // Buscador de Alumnos en tiempo real
    const searchInput = document.getElementById("search-students-input");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            renderStudentsTable();
        });
    }

    // Modal de Credenciales Administrativas
    const studentCredentialsModal = document.getElementById("student-credentials-modal");
    const btnCredentialsModalClose = document.getElementById("btn-credentials-modal-close");
    const formUpdateStudentCredentials = document.getElementById("form-update-student-credentials");
    const credStudentIdInput = document.getElementById("cred-student-id");
    const credStudentNameEl = document.getElementById("cred-student-name");
    const credUsernameInput = document.getElementById("cred-username");
    const credPasswordInput = document.getElementById("cred-password");

    function openCredentialsModal(studentId, name, username) {
        credStudentIdInput.value = studentId;
        credStudentNameEl.textContent = name;
        credUsernameInput.value = username || "";
        credPasswordInput.value = "";
        studentCredentialsModal.classList.remove("hidden");
    }

    function closeCredentialsModal() {
        studentCredentialsModal.classList.add("hidden");
    }

    if (btnCredentialsModalClose) {
        btnCredentialsModalClose.addEventListener("click", closeCredentialsModal);
    }

    if (studentCredentialsModal) {
        studentCredentialsModal.addEventListener("click", (e) => {
            if (e.target === studentCredentialsModal) closeCredentialsModal();
        });
    }

    if (formUpdateStudentCredentials) {
        formUpdateStudentCredentials.addEventListener("submit", async (e) => {
            e.preventDefault();
            const studentId = credStudentIdInput.value;
            const username = credUsernameInput.value;
            const password = credPasswordInput.value || null;
            
            try {
                const response = await fetch(`/api/students/${studentId}/credentials`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });
                
                if (response.ok) {
                    showToast("Credenciales actualizadas exitosamente.", "success");
                    closeCredentialsModal();
                    loadStudentsTable();
                } else {
                    const err = await response.json();
                    showToast(err.detail || "Error al actualizar credenciales.", "error");
                }
            } catch (err) {
                showToast("Error de conexión.", "error");
            }
        });
    }

    async function loadStudentPaymentStatus() {
        if (!selectedStudentId) return;
        const studentPaymentVal = document.getElementById("student-payment-val");
        const warningBanner = document.getElementById("unpaid-warning-banner");
        
        try {
            const response = await fetch(`/api/students/${selectedStudentId}/payments`);
            if (response.ok) {
                const payments = await response.json();
                const now = new Date();
                const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const hasPaid = payments.some(p => p.month === currentMonthStr);
                
                if (hasPaid) {
                    if (studentPaymentVal) {
                        studentPaymentVal.textContent = "Registrado";
                        studentPaymentVal.style.color = "var(--color-success)";
                    }
                    warningBanner?.classList.add("hidden");
                } else {
                    if (studentPaymentVal) {
                        studentPaymentVal.textContent = "Pendiente";
                        studentPaymentVal.style.color = "var(--color-warning)";
                    }
                    warningBanner?.classList.remove("hidden");
                }
            }
        } catch (e) {
            console.error("Error al cargar estado de pago del alumno:", e);
            if (studentPaymentVal) studentPaymentVal.textContent = "Error";
        }
    }

    // Modal de Registro de Pagos (Admin)
    const studentPaymentsModal = document.getElementById("student-payments-modal");
    const btnPaymentsModalClose = document.getElementById("btn-payments-modal-close");
    const formRegisterPayment = document.getElementById("form-register-payment");
    const payStudentIdInput = document.getElementById("pay-student-id");
    const payStudentNameEl = document.getElementById("pay-student-name");
    const payMonthInput = document.getElementById("pay-month");
    const payAmountInput = document.getElementById("pay-amount");
    const paymentHistoryBody = document.getElementById("payment-history-body");

    async function openPaymentsModal(studentId, name) {
        payStudentIdInput.value = studentId;
        payStudentNameEl.textContent = name;
        
        // Cargar mes actual por defecto en el input
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        payMonthInput.value = currentMonthStr;
        payAmountInput.value = 8000; // Valor por defecto sugerido
        
        // Cargar historial
        await loadPaymentHistory(studentId);
        
        studentPaymentsModal.classList.remove("hidden");
    }

    async function loadPaymentHistory(studentId) {
        try {
            const response = await fetch(`/api/students/${studentId}/payments`);
            if (response.ok) {
                const payments = await response.json();
                if (payments.length === 0) {
                    paymentHistoryBody.innerHTML = `<tr><td colspan="3" class="text-muted" style="text-align: center;">Sin pagos registrados</td></tr>`;
                } else {
                    paymentHistoryBody.innerHTML = payments.map(p => {
                        const dateFormatted = new Date(p.payment_date).toLocaleDateString('es-AR');
                        return `
                            <tr>
                                <td><strong>${p.month}</strong></td>
                                <td>$${p.amount}</td>
                                <td>${dateFormatted}</td>
                            </tr>
                        `;
                    }).join("");
                }
            }
        } catch (e) {
            console.error("Error al cargar historial de pagos:", e);
            paymentHistoryBody.innerHTML = `<tr><td colspan="3" class="text-muted" style="text-align: center;">Error al cargar</td></tr>`;
        }
    }

    function closePaymentsModal() {
        studentPaymentsModal.classList.add("hidden");
    }

    if (btnPaymentsModalClose) {
        btnPaymentsModalClose.addEventListener("click", closePaymentsModal);
    }

    if (studentPaymentsModal) {
        studentPaymentsModal.addEventListener("click", (e) => {
            if (e.target === studentPaymentsModal) closePaymentsModal();
        });
    }

    if (formRegisterPayment) {
        formRegisterPayment.addEventListener("submit", async (e) => {
            e.preventDefault();
            const studentId = parseInt(payStudentIdInput.value);
            const month = payMonthInput.value;
            const amount = parseInt(payAmountInput.value);
            const todayStr = new Date().toISOString().split("T")[0];
            
            try {
                const response = await fetch(`/api/students/${studentId}/payments`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        student_id: studentId,
                        month: month,
                        amount: amount,
                        payment_date: todayStr
                    })
                });
                
                if (response.ok) {
                    showToast("Pago registrado exitosamente.", "success");
                    // Recargar historial del modal, tabla principal y panel de pagos
                    await loadPaymentHistory(studentId);
                    loadStudentsTable();
                    if (!document.getElementById("tab-payments-content").classList.contains("hidden")) {
                        loadPaymentsPanel();
                    }
                } else {
                    const err = await response.json();
                    showToast(err.detail || "Error al registrar el pago.", "error");
                }
            } catch (err) {
                showToast("Error de conexión.", "error");
            }
        });
    }

    // --- Panel de Pagos Centralizado ---
    let paymentsSelectedMonth = ""; // Formato "YYYY-MM"
    let paymentsActiveFilter = "all"; // "all", "paid", "unpaid"

    async function loadPaymentsPanel() {
        try {
            await loadStudents();
            renderPaymentsPanel();
        } catch (e) {
            console.error("Error al cargar panel de pagos:", e);
        }
    }

    function renderPaymentsPanel() {
        const tableBody = document.getElementById("admin-payments-table-body");
        if (!tableBody) return;
        
        tableBody.innerHTML = "";
        const searchQuery = (document.getElementById("search-payments-input")?.value || "").toLowerCase().trim();
        
        const filtered = students.filter(s => {
            if (searchQuery && !s.name.toLowerCase().includes(searchQuery)) {
                return false;
            }
            
            const paymentForMonth = (s.payments || []).find(p => p.month === paymentsSelectedMonth);
            const hasPaid = !!paymentForMonth;
            
            if (paymentsActiveFilter === "paid" && !hasPaid) return false;
            if (paymentsActiveFilter === "unpaid" && hasPaid) return false;
            
            return true;
        });
        
        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-muted" style="text-align: center;">No se encontraron registros para este mes y filtro</td></tr>`;
            return;
        }
        
        tableBody.innerHTML = filtered.map(s => {
            const paymentForMonth = (s.payments || []).find(p => p.month === paymentsSelectedMonth);
            const hasPaid = !!paymentForMonth;
            
            const statusBadge = hasPaid 
                ? `<span class="badge-payment paid">Pagado</span>` 
                : `<span class="badge-payment pending">Debiendo</span>`;
                
            const amountText = hasPaid ? `$${paymentForMonth.amount}` : "-";
            const dateText = hasPaid ? new Date(paymentForMonth.payment_date).toLocaleDateString('es-AR') : "-";
            
            const actionButton = hasPaid 
                ? `<button class="btn btn-secondary btn-sm btn-panel-view-history" data-id="${s.id}" style="width: auto; padding: 4px 10px;">
                     <i class="fa-solid fa-list"></i> Historial
                   </button>`
                : `<div style="display: flex; gap: 5px;">
                     <button class="btn btn-success btn-sm btn-panel-pay-month" data-id="${s.id}" style="width: auto; padding: 4px 10px; cursor: pointer;">
                       <i class="fa-solid fa-check"></i> Registrar Cobro
                     </button>
                     <button class="btn btn-secondary btn-sm btn-panel-view-history" data-id="${s.id}" style="width: auto; padding: 4px 10px;">
                       <i class="fa-solid fa-list"></i> Historial
                     </button>
                   </div>`;
                   
            return `
                <tr>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.email}</td>
                    <td>${paymentsSelectedMonth}</td>
                    <td>${amountText}</td>
                    <td>${dateText}</td>
                    <td>${statusBadge}</td>
                    <td>${actionButton}</td>
                </tr>
            `;
        }).join("");
        
        // Enlazar eventos
        tableBody.querySelectorAll(".btn-panel-view-history").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = parseInt(btn.getAttribute("data-id"));
                const student = students.find(x => x.id === id);
                if (student) openPaymentsModal(student.id, student.name);
            });
        });
        
        tableBody.querySelectorAll(".btn-panel-pay-month").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = parseInt(btn.getAttribute("data-id"));
                const student = students.find(x => x.id === id);
                if (student) {
                    payStudentIdInput.value = student.id;
                    payStudentNameEl.textContent = student.name;
                    payMonthInput.value = paymentsSelectedMonth;
                    payAmountInput.value = 8000;
                    loadPaymentHistory(student.id);
                    studentPaymentsModal.classList.remove("hidden");
                }
            });
        });
    }

    // Configurar listeners de la barra de filtros de pagos
    const paymentsMonthSelect = document.getElementById("admin-payments-month-select");
    if (paymentsMonthSelect) {
        paymentsMonthSelect.addEventListener("change", (e) => {
            paymentsSelectedMonth = e.target.value;
            renderPaymentsPanel();
        });
    }

    const searchPaymentsInput = document.getElementById("search-payments-input");
    if (searchPaymentsInput) {
        searchPaymentsInput.addEventListener("input", () => {
            renderPaymentsPanel();
        });
    }

    document.querySelectorAll(".btn-filter-pay-status").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".btn-filter-pay-status").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            paymentsActiveFilter = btn.getAttribute("data-filter");
            renderPaymentsPanel();
        });
    });

    // ----------------------------------------------------
    // Inicialización del Sistema (y Verificación de Sesión)
    // ----------------------------------------------------
    // Inicializar mes por defecto en panel de pagos
    const initNow = new Date();
    paymentsSelectedMonth = `${initNow.getFullYear()}-${String(initNow.getMonth() + 1).padStart(2, '0')}`;
    const paymentsMonthSelectInit = document.getElementById("admin-payments-month-select");
    if (paymentsMonthSelectInit) {
        paymentsMonthSelectInit.value = paymentsSelectedMonth;
    }

    formatDateRangeLabel();
    
    // Cargar datos básicos primero
    loadStudents().then(() => {
        loadTemplates().then(() => {
            // Verificar si hay una sesión guardada en localStorage
            const savedUser = localStorage.getItem("currentUser");
            if (savedUser) {
                try {
                    const user = JSON.parse(savedUser);
                    roleMode = user.role;
                    if (roleMode === "student") {
                        selectedStudentId = user.id;
                    }
                    setRole(roleMode); // Carga la agenda y ajusta la UI automáticamente
                } catch (e) {
                    console.error("Error al restaurar sesión:", e);
                    localStorage.removeItem("currentUser");
                    loadAgenda();
                }
            } else {
                // Si no hay sesión, dejamos la landing page visible
                loadAgenda();
            }
        });
    });
});
