import datetime
from sqlalchemy.orm import Session
from app import models, database

def seed_data():
    import os
    db_file = "C:/Users/paula/.gemini/antigravity/scratch/pilates-control-app/pilates.db"
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
            print("Base de datos anterior eliminada.")
        except Exception as e:
            print("No se pudo eliminar la base de datos anterior:", e)
            
    db = database.SessionLocal()
    
    # Asegurar que las tablas existen
    models.Base.metadata.create_all(bind=database.engine)
    
    # 1. Verificar si ya hay datos cargados
    if db.query(models.Student).first() is not None:
        print("La base de datos ya contiene datos. Omitiendo carga inicial.")
        db.close()
        return

    print("Cargando datos de prueba iniciales...")

    # 2. Crear Alumnos
    student_names = [
        ("Ana Gómez", "ana.gomez@gmail.com"),
        ("Bruno Díaz", "bruno.diaz@batcave.com"),
        ("Carlos Pérez", "carlos.perez@yahoo.com"),
        ("Diana Prince", "diana.prince@themyscira.com"),
        ("Elena Nito", "elena.nito@gmail.com"),
        ("Federico Lupi", "f.lupi@hotmail.com"),
        ("Gabriel García", "gabo@macondo.com"),
        ("Hugo Boss", "hugo@boss.com"),
        ("Irene Adler", "irene.adler@sherlock.com"),
        ("Juan Valdés", "juan.valdes@cafe.com"),
        ("Karina Jelinek", "karina@oligos.com"),
        ("Lucas Silva", "lucas@futbol.com"),
        ("María Becerra", "la-nena-de-argentina@musica.com"),
        ("Nicolás Furtado", "diosito@elmarginal.com"),
        ("Olivia Rodrigo", "olivia@sour.com"),
        ("Pablo Alborán", "pablo@alboran.com"),
        ("Romina Malaspina", "romi@canal26.com"),
        ("Santiago Motorizado", "santi@elmato.com")
    ]
    
    students = []
    from app import auth_utils
    for name, email in student_names:
        username = email.split('@')[0]
        hashed_pwd = auth_utils.hash_password("123456")
        s = models.Student(name=name, email=email, username=username, password_hash=hashed_pwd)
        db.add(s)
        students.append(s)
    
    db.commit()
    # Refrescar alumnos para tener IDs
    for s in students:
        db.refresh(s)
    print(f"-> {len(students)} Alumnos creados con credenciales (usuario: correo_sin_dominio, clave: 123456).")

    # 2b. Crear Administradores
    admins = [
        ("Paula", "paula", "powerhouse123"),
        ("Admin General", "admin", "admin123")
    ]
    for name, username, pwd in admins:
        hashed_pwd = auth_utils.hash_password(pwd)
        adm = models.Administrator(name=name, username=username, password_hash=hashed_pwd)
        db.add(adm)
    db.commit()
    print("-> 2 Administradores creados (paula/powerhouse123, admin/admin123).")

    # 3. Crear Horarios Semanales (ClassTemplates)
    # Lunes (0) a Viernes (4). Horarios: 08:00, 09:00, 17:00, 18:00, 19:00
    times = ["08:00", "09:00", "17:00", "18:00", "19:00"]
    templates = []
    
    for day in range(5):
        for t in times:
            template = models.ClassTemplate(day_of_week=day, time=t, max_capacity=10)
            db.add(template)
            templates.append(template)
            
    db.commit()
    for t in templates:
        db.refresh(t)
    print(f"-> {len(templates)} Horarios de clase creados (Plantilla Lunes a Viernes).")

    # 4. Asignar Horarios Fijos (FixedSchedule)
    # Vamos a distribuir a los alumnos en algunos horarios fijos recurrentes
    # Distribuir para simular clases llenas (9 o 10 alumnos) y clases parciales.
    
    # Asignaciones simuladas:
    # Lunes 09:00 (Lleno - 10 alumnos)
    monday_9 = next(t for t in templates if t.day_of_week == 0 and t.time == "09:00")
    for s in students[:10]:
        db.add(models.FixedSchedule(student_id=s.id, class_template_id=monday_9.id))

    # Martes 18:00 (Ocupación media - 6 alumnos)
    tuesday_18 = next(t for t in templates if t.day_of_week == 1 and t.time == "18:00")
    for s in students[4:10]:
        db.add(models.FixedSchedule(student_id=s.id, class_template_id=tuesday_18.id))

    # Miércoles 17:00 (Ocupación alta - 8 alumnos)
    wednesday_17 = next(t for t in templates if t.day_of_week == 2 and t.time == "17:00")
    for s in students[6:14]:
        db.add(models.FixedSchedule(student_id=s.id, class_template_id=wednesday_17.id))

    # Jueves 19:00 (Ocupación media - 5 alumnos)
    thursday_19 = next(t for t in templates if t.day_of_week == 3 and t.time == "19:00")
    for s in students[10:15]:
        db.add(models.FixedSchedule(student_id=s.id, class_template_id=thursday_19.id))

    # Viernes 08:00 (Ocupación baja - 3 alumnos)
    friday_8 = next(t for t in templates if t.day_of_week == 4 and t.time == "08:00")
    for s in students[15:18]:
        db.add(models.FixedSchedule(student_id=s.id, class_template_id=friday_8.id))

    # Adicional: Alumnos que asisten 2 veces por semana (ej. Lunes y Miércoles 19:00)
    monday_19 = next(t for t in templates if t.day_of_week == 0 and t.time == "19:00")
    wednesday_19 = next(t for t in templates if t.day_of_week == 2 and t.time == "19:00")
    for s in students[:4]:
        db.add(models.FixedSchedule(student_id=s.id, class_template_id=monday_19.id))
        db.add(models.FixedSchedule(student_id=s.id, class_template_id=wednesday_19.id))

    db.commit()
    print("-> Horarios fijos recurrentes asignados.")

    # 5. Cargar Excepciones / Faltas y Créditos para el Mes Actual
    # Crearemos inasistencias en fechas de este mes para generar créditos iniciales
    today = datetime.date.today()
    
    # Calcular el lunes de esta semana o semana pasada para reportar faltas con fechas concretas
    base_monday = today - datetime.timedelta(days=today.weekday())
    prev_monday = base_monday - datetime.timedelta(days=7) # Lunes de la semana pasada
    
    # El alumno Ana Gómez (id=1) faltó el Lunes pasado a las 09:00 (era fija) -> Genera 1 crédito
    db.add(models.Booking(
        student_id=students[0].id,
        class_template_id=monday_9.id,
        date=prev_monday,
        booking_type='absence'
    ))
    
    # El alumno Bruno Díaz (id=2) faltó el Lunes pasado a las 09:00 (era fijo) -> Genera 1 crédito
    db.add(models.Booking(
        student_id=students[1].id,
        class_template_id=monday_9.id,
        date=prev_monday,
        booking_type='absence'
    ))

    # El alumno Bruno Díaz ya recuperó esa clase el Viernes pasado a las 08:00 -> Consume 1 crédito
    db.add(models.Booking(
        student_id=students[1].id,
        class_template_id=friday_8.id,
        date=prev_monday + datetime.timedelta(days=4), # Viernes pasado
        booking_type='recovery'
    ))

    # Resultado esperado:
    # Ana Gómez tiene 1 crédito ganado, 0 usados -> 1 disponible
    # Bruno Díaz tiene 1 crédito ganado, 1 usado -> 0 disponibles

    # 6. Cargar Pagos de prueba para el mes actual e históricos
    current_month_str = today.strftime("%Y-%m")
    # Registrar pago del mes actual para Ana Gómez (id=1) y Carlos Pérez (id=3)
    db.add(models.Payment(
        student_id=students[0].id,
        month=current_month_str,
        amount=8000,
        payment_date=today - datetime.timedelta(days=5)
    ))
    db.add(models.Payment(
        student_id=students[2].id,
        month=current_month_str,
        amount=8000,
        payment_date=today - datetime.timedelta(days=4)
    ))
    # Registrar pago del mes anterior para Ana Gómez
    last_month_date = today - datetime.timedelta(days=30)
    last_month_str = last_month_date.strftime("%Y-%m")
    db.add(models.Payment(
        student_id=students[0].id,
        month=last_month_str,
        amount=7500,
        payment_date=last_month_date - datetime.timedelta(days=2)
    ))

    db.commit()
    db.close()
    print("-> Historial de inasistencias y créditos simulados creados con éxito.")
    print("Base de datos de Pilates inicializada correctamente.")

if __name__ == "__main__":
    seed_data()
