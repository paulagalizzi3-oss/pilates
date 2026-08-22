import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app import models, schemas

# --- Gestión de Alumnos ---

def get_student(db: Session, student_id: int):
    return db.query(models.Student).filter(models.Student.id == student_id).first()

def get_student_by_email(db: Session, email: str):
    return db.query(models.Student).filter(models.Student.email == email).first()

def get_all_students(db: Session):
    return db.query(models.Student).order_by(models.Student.name).all()

def create_student(db: Session, student: schemas.StudentCreate):
    from app import auth_utils
    hashed_pwd = auth_utils.hash_password(student.password)
    db_student = models.Student(
        name=student.name, 
        email=student.email,
        username=student.username,
        password_hash=hashed_pwd
    )
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    
    if student.initial_class_template_ids:
        for template_id in student.initial_class_template_ids:
            db_schedule = models.FixedSchedule(
                student_id=db_student.id,
                class_template_id=template_id
            )
            db.add(db_schedule)
        db.commit()
        db.refresh(db_student)
        
    return db_student

def delete_student(db: Session, student_id: int):
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if db_student:
        db.delete(db_student)
        db.commit()
        return True
    return False


# --- Gestión de Horarios Recurrentes (Fijos) ---

def create_class_template(db: Session, template: schemas.ClassTemplateCreate):
    db_template = models.ClassTemplate(
        day_of_week=template.day_of_week,
        time=template.time,
        max_capacity=template.max_capacity
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

def get_class_templates(db: Session):
    return db.query(models.ClassTemplate).order_by(models.ClassTemplate.day_of_week, models.ClassTemplate.time).all()

def get_class_template(db: Session, template_id: int):
    return db.query(models.ClassTemplate).filter(models.ClassTemplate.id == template_id).first()

def delete_class_template(db: Session, template_id: int):
    db_template = db.query(models.ClassTemplate).filter(models.ClassTemplate.id == template_id).first()
    if db_template:
        db.delete(db_template)
        db.commit()
        return True
    return False

def assign_fixed_schedule(db: Session, assignment: schemas.FixedScheduleCreate):
    # Verificar si ya tiene esa asignación
    existing = db.query(models.FixedSchedule).filter(
        models.FixedSchedule.student_id == assignment.student_id,
        models.FixedSchedule.class_template_id == assignment.class_template_id
    ).first()
    if existing:
        return existing
        
    db_schedule = models.FixedSchedule(
        student_id=assignment.student_id,
        class_template_id=assignment.class_template_id
    )
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

def remove_fixed_schedule(db: Session, student_id: int, class_template_id: int):
    db_schedule = db.query(models.FixedSchedule).filter(
        models.FixedSchedule.student_id == student_id,
        models.FixedSchedule.class_template_id == class_template_id
    ).first()
    if db_schedule:
        db.delete(db_schedule)
        db.commit()
        return True
    return False


# --- Lógica de Negocio: Créditos y Cupos ---

def get_month_date_range(year: int, month: int):
    """Retorna el primer y último día de un mes específico."""
    first_day = datetime.date(year, month, 1)
    if month == 12:
        last_day = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
    else:
        last_day = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)
    return first_day, last_day

def get_student_credits(db: Session, student_id: int, query_date: datetime.date) -> schemas.StudentCredits:
    """
    Calcula los créditos de un alumno para el mes de la fecha provista.
    Fórmula: Faltas en el mes (absence) - Recuperaciones en el mes (recovery)
    """
    student = get_student(db, student_id)
    if not student:
        raise ValueError("Alumno no encontrado")
        
    year = query_date.year
    month = query_date.month
    first_day, last_day = get_month_date_range(year, month)
    
    # 1. Contar inasistencias reportadas en el mes
    absences = db.query(models.Booking).filter(
        models.Booking.student_id == student_id,
        models.Booking.booking_type == 'absence',
        models.Booking.date >= first_day,
        models.Booking.date <= last_day
    ).count()
    
    # 2. Contar recuperaciones reservadas en el mes
    recoveries = db.query(models.Booking).filter(
        models.Booking.student_id == student_id,
        models.Booking.booking_type == 'recovery',
        models.Booking.date >= first_day,
        models.Booking.date <= last_day
    ).count()
    
    credits_available = max(0, absences - recoveries)
    
    return schemas.StudentCredits(
        student_id=student_id,
        student_name=student.name,
        month=f"{year:04d}-{month:02d}",
        credits_earned=absences,
        credits_used=recoveries,
        credits_available=credits_available
    )

def get_class_instance(db: Session, template: models.ClassTemplate, class_date: datetime.date) -> schemas.ClassInstance:
    """
    Calcula dinámicamente el estado de una clase en una fecha dada.
    """
    # 1. Alumnos fijos de este horario semanal
    fixed_schedules = db.query(models.FixedSchedule).filter(
        models.FixedSchedule.class_template_id == template.id
    ).all()
    fixed_students = [fs.student for fs in fixed_schedules]
    
    # 2. Excepciones (Faltas y recuperaciones) en esta fecha exacta
    bookings = db.query(models.Booking).filter(
        models.Booking.class_template_id == template.id,
        models.Booking.date == class_date
    ).all()
    
    absent_student_ids = {b.student_id for b in bookings if b.booking_type == 'absence'}
    recovery_students = [b.student for b in bookings if b.booking_type == 'recovery']
    
    # Separar fijos en 'asistentes reales' y 'ausentes'
    actual_fixed_students = [s for s in fixed_students if s.id not in absent_student_ids]
    absent_students = [s for s in fixed_students if s.id in absent_student_ids]
    
    # Ocupación total
    occupied_count = len(actual_fixed_students) + len(recovery_students)
    available_spots = max(0, template.max_capacity - occupied_count)
    
    # Convertir a objetos simples para la respuesta
    def to_simple(student_list):
        return [schemas.StudentSimple(id=s.id, name=s.name, email=s.email) for s in student_list]
        
    return schemas.ClassInstance(
        class_template_id=template.id,
        day_of_week=template.day_of_week,
        time=template.time,
        date=class_date,
        max_capacity=template.max_capacity,
        occupied_count=occupied_count,
        available_spots=available_spots,
        fixed_students=to_simple(actual_fixed_students),
        absent_students=to_simple(absent_students),
        recovery_students=to_simple(recovery_students)
    )

# --- Acciones Clave: Liberar y Recuperar ---

def release_spot(db: Session, student_id: int, class_template_id: int, class_date: datetime.date):
    """
    Reporta una inasistencia ('absence') para una fecha.
    Verifica que el alumno tenga horario fijo asignado en esa clase y no esté registrado ya.
    """
    # 1. Validar que el alumno es fijo en este horario
    is_fixed = db.query(models.FixedSchedule).filter(
        models.FixedSchedule.student_id == student_id,
        models.FixedSchedule.class_template_id == class_template_id
    ).first()
    
    if not is_fixed:
        raise ValueError("El alumno no asiste fijo a esta clase, no puede reportar inasistencia.")
        
    # 2. Validar que no haya reportado la falta previamente
    existing = db.query(models.Booking).filter(
        models.Booking.student_id == student_id,
        models.Booking.class_template_id == class_template_id,
        models.Booking.date == class_date,
        models.Booking.booking_type == 'absence'
    ).first()
    
    if existing:
        return existing
        
    # 3. Crear el registro de falta
    db_absence = models.Booking(
        student_id=student_id,
        class_template_id=class_template_id,
        date=class_date,
        booking_type='absence'
    )
    db.add(db_absence)
    db.commit()
    db.refresh(db_absence)
    return db_absence

def book_recovery(db: Session, student_id: int, class_template_id: int, class_date: datetime.date):
    """
    Reserva una clase de recuperación ('recovery') consumiendo un crédito del mes actual.
    Verifica cupo disponible y créditos activos del alumno.
    """
    # 1. Comprobar créditos del mes
    credits_info = get_student_credits(db, student_id, class_date)
    if credits_info.credits_available <= 0:
        raise ValueError("El alumno no dispone de créditos de recuperación para este mes.")
        
    # 2. Comprobar capacidad disponible en la fecha
    template = db.query(models.ClassTemplate).filter(models.ClassTemplate.id == class_template_id).first()
    if not template:
        raise ValueError("Horario de clase no encontrado.")
        
    class_inst = get_class_instance(db, template, class_date)
    if class_inst.available_spots <= 0:
        raise ValueError("No hay cupos disponibles en este turno para la fecha solicitada.")
        
    # 3. Validar que el alumno no asista fijo a esa misma clase
    is_fixed = db.query(models.FixedSchedule).filter(
        models.FixedSchedule.student_id == student_id,
        models.FixedSchedule.class_template_id == class_template_id
    ).first()
    
    if is_fixed:
        raise ValueError("El alumno ya asiste de forma fija a esta clase.")
            
    # 4. Validar que no tenga otra recuperación ya reservada en este turno
    existing_rec = db.query(models.Booking).filter(
        models.Booking.student_id == student_id,
        models.Booking.class_template_id == class_template_id,
        models.Booking.date == class_date,
        models.Booking.booking_type == 'recovery'
    ).first()
    if existing_rec:
        return existing_rec

    # 5. Crear el registro de recuperación
    db_recovery = models.Booking(
        student_id=student_id,
        class_template_id=class_template_id,
        date=class_date,
        booking_type='recovery'
    )
    db.add(db_recovery)
    db.commit()
    db.refresh(db_recovery)
    return db_recovery

# --- Revocaciones ---

def cancel_absence(db: Session, student_id: int, class_template_id: int, class_date: datetime.date):
    """
    Revoca un aviso de inasistencia (el alumno decide asistir después de todo).
    Requiere comprobar que quede cupo (en caso de que su lugar haya sido tomado por una recuperación).
    """
    absence = db.query(models.Booking).filter(
        models.Booking.student_id == student_id,
        models.Booking.class_template_id == class_template_id,
        models.Booking.date == class_date,
        models.Booking.booking_type == 'absence'
    ).first()
    
    if not absence:
        raise ValueError("No existe registro de inasistencia para este alumno en la fecha dada.")
        
    # Verificar si hay espacio para reincorporarse
    template = db.query(models.ClassTemplate).filter(models.ClassTemplate.id == class_template_id).first()
    class_inst = get_class_instance(db, template, class_date)
    
    if class_inst.available_spots <= 0:
        raise ValueError("No se puede cancelar la falta: el cupo de la clase está lleno (otra persona tomó el lugar).")
        
    db.delete(absence)
    db.commit()
    return True

def cancel_recovery(db: Session, student_id: int, class_template_id: int, class_date: datetime.date):
    """
    Cancela una reservación de recuperación, liberando el cupo y restituyendo el crédito al alumno.
    """
    recovery = db.query(models.Booking).filter(
        models.Booking.student_id == student_id,
        models.Booking.class_template_id == class_template_id,
        models.Booking.date == class_date,
        models.Booking.booking_type == 'recovery'
    ).first()
    
    if not recovery:
        raise ValueError("No existe reserva de recuperación para este alumno en la fecha dada.")
        
    db.delete(recovery)
    db.commit()
    return True


# --- Operaciones de Autenticación y Administradores ---

def get_student_by_username(db: Session, username: str):
    return db.query(models.Student).filter(models.Student.username == username).first()

def get_admin_by_username(db: Session, username: str):
    return db.query(models.Administrator).filter(models.Administrator.username == username).first()

def create_admin(db: Session, admin: schemas.AdminCreate):
    from app import auth_utils
    hashed_pwd = auth_utils.hash_password(admin.password)
    db_admin = models.Administrator(
        name=admin.name,
        username=admin.username,
        password_hash=hashed_pwd
    )
    db.add(db_admin)
    db.commit()
    db.refresh(db_admin)
    return db_admin

def update_student_credentials(db: Session, student_id: int, creds: schemas.UpdateCredentialsRequest):
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not db_student:
        return None
    
    db_student.username = creds.username
    if creds.password:
        from app import auth_utils
        db_student.password_hash = auth_utils.hash_password(creds.password)
        
    db.commit()
    db.refresh(db_student)
    return db_student


# --- Operaciones de Pagos Mensuales ---

def create_payment(db: Session, payment: schemas.PaymentCreate):
    db_payment = models.Payment(
        student_id=payment.student_id,
        month=payment.month,
        amount=payment.amount,
        payment_date=payment.payment_date
    )
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment

def get_student_payments(db: Session, student_id: int):
    return db.query(models.Payment).filter(models.Payment.student_id == student_id).order_by(models.Payment.month.desc()).all()

def get_student_payment_for_month(db: Session, student_id: int, month: str):
    return db.query(models.Payment).filter(
        models.Payment.student_id == student_id,
        models.Payment.month == month
    ).first()
