import os
import datetime
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import models, schemas, crud, config
from app.database import get_db, engine

# Asegurar que se crean las tablas al iniciar la aplicación
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Pilates Studio Booking Manager",
    description="Sistema de gestión de turnos, asistencias y recuperaciones de Pilates",
    version="1.0.0"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos auxiliares para solicitudes POST
class BookingRequest(BaseModel):
    student_id: int
    class_template_id: int
    date: datetime.date


# --- Endpoints de Alumnos ---

@app.get("/api/students", response_model=List[schemas.Student])
def list_students(db: Session = Depends(get_db)):
    """Devuelve el listado de alumnos con sus créditos del mes actual calculados dinámicamente y sus horarios fijos."""
    students = crud.get_all_students(db)
    today = datetime.date.today()
    day_names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
    
    result = []
    for s in students:
        credits_info = crud.get_student_credits(db, s.id, today)
        
        schedules_list = []
        for fs in s.fixed_schedules:
            day_idx = fs.class_template.day_of_week
            day_name = day_names[day_idx] if 0 <= day_idx < 5 else "Desconocido"
            schedules_list.append(schemas.FixedScheduleSimple(
                id=fs.id,
                class_template_id=fs.class_template_id,
                day_name=day_name,
                time=fs.class_template.time
            ))
            
        result.append(schemas.Student(
            id=s.id,
            name=s.name,
            email=s.email,
            username=s.username,
            recovery_credits=credits_info.credits_available,
            fixed_schedules=schedules_list,
            payments=s.payments
        ))
    return result

@app.post("/api/students", response_model=schemas.Student)
def create_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    """Crea un nuevo alumno."""
    db_student_email = crud.get_student_by_email(db, email=student.email)
    if db_student_email:
        raise HTTPException(status_code=400, detail="El email ya se encuentra registrado.")
        
    db_student_user = crud.get_student_by_username(db, username=student.username)
    if db_student_user:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya se encuentra registrado.")
    
    new_student = crud.create_student(db=db, student=student)
    
    day_names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
    schedules_list = []
    for fs in new_student.fixed_schedules:
        day_idx = fs.class_template.day_of_week
        day_name = day_names[day_idx] if 0 <= day_idx < 5 else "Desconocido"
        schedules_list.append(schemas.FixedScheduleSimple(
            id=fs.id,
            class_template_id=fs.class_template_id,
            day_name=day_name,
            time=fs.class_template.time
        ))
        
    return schemas.Student(
        id=new_student.id,
        name=new_student.name,
        email=new_student.email,
        username=new_student.username,
        recovery_credits=0,
        fixed_schedules=schedules_list,
        payments=new_student.payments
    )

@app.delete("/api/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    """Elimina un alumno del sistema."""
    success = crud.delete_student(db, student_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alumno no encontrado.")
    return {"message": "Alumno eliminado exitosamente."}

@app.get("/api/students/{student_id}/credits", response_model=schemas.StudentCredits)
def get_student_credits(
    student_id: int, 
    query_date: Optional[datetime.date] = Query(None), 
    db: Session = Depends(get_db)
):
    """Obtiene el detalle de créditos para un mes específico (o mes actual si se omite la fecha)."""
    if not query_date:
        query_date = datetime.date.today()
    try:
        return crud.get_student_credits(db, student_id, query_date)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# --- Endpoints de Turnos / Plantillas ---

@app.get("/api/templates", response_model=List[schemas.ClassTemplate])
def list_templates(db: Session = Depends(get_db)):
    """Muestra todos los turnos fijos configurados semanalmente."""
    return crud.get_class_templates(db)

@app.post("/api/templates", response_model=schemas.ClassTemplate)
def create_template(template: schemas.ClassTemplateCreate, db: Session = Depends(get_db)):
    """Registra un nuevo horario en la plantilla semanal."""
    try:
        return crud.create_class_template(db, template)
    except Exception:
        raise HTTPException(status_code=400, detail="Ya existe un turno configurado para ese día y hora.")

@app.delete("/api/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    """Elimina un turno semanal del sistema."""
    success = crud.delete_class_template(db, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Turno no encontrado.")
    return {"message": "Turno semanal eliminado exitosamente."}


# --- Horarios Fijos (FixedSchedules) ---

@app.post("/api/schedules/assign")
def assign_schedule(assignment: schemas.FixedScheduleCreate, db: Session = Depends(get_db)):
    """Asigna a un alumno un turno fijo recurrente en la semana."""
    try:
        crud.assign_fixed_schedule(db, assignment)
        return {"message": "Turno fijo asignado con éxito."}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Error al asignar horario fijo. Compruebe si ya está asignado.")

@app.post("/api/schedules/remove")
def remove_schedule(assignment: schemas.FixedScheduleCreate, db: Session = Depends(get_db)):
    """Elimina la asignación de un turno fijo recurrente para un alumno."""
    success = crud.remove_fixed_schedule(db, assignment.student_id, assignment.class_template_id)
    if not success:
        raise HTTPException(status_code=404, detail="No se encontró esa asignación de horario.")
    return {"message": "Asignación de horario fijo removida."}


# --- Endpoints de Agenda Calendario (Agenda) ---

@app.get("/api/agenda", response_model=List[schemas.AgendaDay])
def get_weekly_agenda(
    start_date: Optional[datetime.date] = Query(None), 
    student_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Calcula y devuelve la agenda de Lunes a Viernes a partir de la fecha seleccionada.
    Si se omite, calcula la semana del Lunes actual.
    Si se proporciona student_id, se ocultan los nombres de los otros estudiantes por privacidad.
    """
    # Si no hay fecha, buscar el lunes de la semana actual
    if not start_date:
        today = datetime.date.today()
        # weekday() es 0 para Lunes, ..., 6 para Domingo
        start_date = today - datetime.timedelta(days=today.weekday())
        
    # Asegurar que empezamos un Lunes en el cálculo (si se pasa otro día, forzar al Lunes de esa semana)
    start_date = start_date - datetime.timedelta(days=start_date.weekday())
    
    templates = crud.get_class_templates(db)
    agenda = []
    
    day_names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
    
    for i in range(5):  # Lunes (0) a Viernes (4)
        current_date = start_date + datetime.timedelta(days=i)
        day_classes = []
        
        # Filtrar plantillas que corresponden a este día de la semana
        day_templates = [t for t in templates if t.day_of_week == i]
        
        for template in day_templates:
            class_instance = crud.get_class_instance(db, template, current_date)
            if student_id is not None:
                # Filtrar listas de alumnos para ocultar otros estudiantes
                # Preservamos los contadores originales de ocupación y cupos libres
                filtered_instance = schemas.ClassInstance(
                    class_template_id=class_instance.class_template_id,
                    day_of_week=class_instance.day_of_week,
                    time=class_instance.time,
                    date=class_instance.date,
                    max_capacity=class_instance.max_capacity,
                    occupied_count=class_instance.occupied_count,
                    available_spots=class_instance.available_spots,
                    fixed_students=[s for s in class_instance.fixed_students if s.id == student_id],
                    absent_students=[s for s in class_instance.absent_students if s.id == student_id],
                    recovery_students=[s for s in class_instance.recovery_students if s.id == student_id]
                )
                day_classes.append(filtered_instance)
            else:
                day_classes.append(class_instance)
            
        agenda.append(schemas.AgendaDay(
            date=current_date,
            day_name=day_names[i],
            classes=day_classes
        ))
        
    return agenda


# --- Acciones de Reservas: Liberar y Recuperar ---

@app.post("/api/bookings/release")
def api_release_spot(req: BookingRequest, db: Session = Depends(get_db)):
    """Registra una falta del alumno en un día específico, liberando su cupo y dándole un crédito."""
    try:
        crud.release_spot(db, req.student_id, req.class_template_id, req.date)
        return {"message": "Cupo liberado con éxito. Se ha otorgado 1 crédito de recuperación para este mes."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/bookings/recover")
def api_book_recovery(req: BookingRequest, db: Session = Depends(get_db)):
    """Reserva un turno libre para recuperar clase, consumiendo un crédito del alumno."""
    try:
        crud.book_recovery(db, req.student_id, req.class_template_id, req.date)
        return {"message": "Clase de recuperación agendada con éxito. Se descontó 1 crédito de este mes."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/bookings/cancel-absence")
def api_cancel_absence(req: BookingRequest, db: Session = Depends(get_db)):
    """Anula un reporte de falta de un alumno, permitiéndole asistir de nuevo (si hay cupo libre)."""
    try:
        crud.cancel_absence(db, req.student_id, req.class_template_id, req.date)
        return {"message": "Reporte de inasistencia cancelado. Se restableció la asistencia normal del alumno."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/bookings/cancel-recovery")
def api_cancel_recovery(req: BookingRequest, db: Session = Depends(get_db)):
    """Cancela una clase de recuperación, liberando el lugar y restituyendo el crédito al alumno."""
    try:
        crud.cancel_recovery(db, req.student_id, req.class_template_id, req.date)
        return {"message": "Reserva de recuperación cancelada. El crédito ha sido devuelto."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Endpoints de Autenticación y Credenciales ---

@app.post("/api/auth/login", response_model=schemas.LoginResponse)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Valida el ingreso de un usuario (alumno o administrador) con su contraseña."""
    from app import auth_utils
    if req.role == "admin":
        admin = crud.get_admin_by_username(db, req.username)
        if not admin or not auth_utils.verify_password(req.password, admin.password_hash):
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")
        return schemas.LoginResponse(
            success=True,
            id=admin.id,
            name=admin.name,
            username=admin.username,
            role="admin"
        )
    elif req.role == "student":
        student = crud.get_student_by_username(db, req.username)
        if not student or not auth_utils.verify_password(req.password, student.password_hash):
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")
        return schemas.LoginResponse(
            success=True,
            id=student.id,
            name=student.name,
            username=student.username,
            role="student"
        )
    else:
        raise HTTPException(status_code=400, detail="Rol inválido.")

@app.put("/api/students/{student_id}/credentials", response_model=schemas.Student)
def update_student_creds(student_id: int, creds: schemas.UpdateCredentialsRequest, db: Session = Depends(get_db)):
    """Actualiza las credenciales de ingreso de un alumno."""
    # Verificar si el usuario que quiere cambiar ya existe en otro estudiante
    db_student_user = crud.get_student_by_username(db, username=creds.username)
    if db_student_user and db_student_user.id != student_id:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya se encuentra registrado.")
        
    db_student = crud.update_student_credentials(db, student_id, creds)
    if not db_student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado.")
        
    today = datetime.date.today()
    credits_info = crud.get_student_credits(db, db_student.id, today)
    
    day_names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
    schedules_list = []
    for fs in db_student.fixed_schedules:
        day_idx = fs.class_template.day_of_week
        day_name = day_names[day_idx] if 0 <= day_idx < 5 else "Desconocido"
        schedules_list.append(schemas.FixedScheduleSimple(
            id=fs.id,
            class_template_id=fs.class_template_id,
            day_name=day_name,
            time=fs.class_template.time
        ))
        
    return schemas.Student(
        id=db_student.id,
        name=db_student.name,
        email=db_student.email,
        username=db_student.username,
        recovery_credits=credits_info.credits_available,
        fixed_schedules=schedules_list,
        payments=db_student.payments
    )


# --- Endpoints de Pagos Mensuales ---

@app.get("/api/students/{student_id}/payments", response_model=List[schemas.Payment])
def get_student_payments(student_id: int, db: Session = Depends(get_db)):
    """Obtiene el historial de pagos de un alumno."""
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not db_student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado.")
    return crud.get_student_payments(db, student_id)

@app.post("/api/students/{student_id}/payments", response_model=schemas.Payment)
def create_student_payment(student_id: int, payment: schemas.PaymentCreate, db: Session = Depends(get_db)):
    """Registra un nuevo pago mensual para un alumno."""
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not db_student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado.")
    
    # Validar que no exista un pago para ese mes
    existing = crud.get_student_payment_for_month(db, student_id, payment.month)
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya se ha registrado un pago para el mes {payment.month}.")
        
    return crud.create_payment(db, payment)


# --- Enrutador Frontend ---

@app.get("/")
def read_root():
    """Sirve la página del Dashboard administrativo y de usuario."""
    index_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Dashboard index.html no encontrado. Asegúrese de colocarlo en el directorio web/."}

# Servir estáticos
static_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web")
if os.path.exists(static_path):
    app.mount("/web", StaticFiles(directory=static_path), name="web")
