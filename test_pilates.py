import unittest
import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app import models, crud, schemas

class TestPilatesScheduler(unittest.TestCase):
    def setUp(self):
        # Usar base de datos en memoria para pruebas rápidas
        self.engine = create_engine("sqlite:///:memory:")
        models.Base.metadata.create_all(self.engine)
        Session = sessionmaker(bind=self.engine)
        self.db = Session()
        self.db.execute(text("PRAGMA foreign_keys=ON"))
        self.seed_test_db()

    def tearDown(self):
        self.db.close()
        models.Base.metadata.drop_all(self.engine)

    def seed_test_db(self):
        # 1. Crear Alumnos
        self.student_a = models.Student(name="Alumno Fijo A", email="fijo.a@test.com", username="fijoa", password_hash="dummy")
        self.student_b = models.Student(name="Alumno Fijo B", email="fijo.b@test.com", username="fijob", password_hash="dummy")
        self.student_c = models.Student(name="Alumno Libre C", email="libre.c@test.com", username="librec", password_hash="dummy")
        
        self.db.add_all([self.student_a, self.student_b, self.student_c])
        self.db.commit()

        # 2. Crear Horario de Clase (Lunes 18:00 hs)
        # Lunes es 0, capacidad max 2 (para probar llenado fácil)
        self.class_monday_18 = models.ClassTemplate(day_of_week=0, time="18:00", max_capacity=2)
        self.db.add(self.class_monday_18)
        self.db.commit()

        # 3. Asignar fijos (Alumno A y B son fijos los Lunes 18:00 hs)
        self.db.add(models.FixedSchedule(student_id=self.student_a.id, class_template_id=self.class_monday_18.id))
        self.db.add(models.FixedSchedule(student_id=self.student_b.id, class_template_id=self.class_monday_18.id))
        self.db.commit()

    def test_class_occupancy_calculations(self):
        """Verifica que el cálculo de capacidad y alumnos reales funcione."""
        target_date = datetime.date(2026, 6, 22) # Un lunes
        
        # Ocupación inicial: 2 alumnos fijos asignados
        class_inst = crud.get_class_instance(self.db, self.class_monday_18, target_date)
        self.assertEqual(class_inst.occupied_count, 2)
        self.assertEqual(class_inst.available_spots, 0)
        self.assertEqual(len(class_inst.fixed_students), 2)
        self.assertEqual(len(class_inst.absent_students), 0)

        # Alumno A reporta falta
        crud.release_spot(self.db, self.student_a.id, self.class_monday_18.id, target_date)
        
        # Ocupación ahora debe ser 1 (B sigue y A falta), 1 cupo disponible
        class_inst = crud.get_class_instance(self.db, self.class_monday_18, target_date)
        self.assertEqual(class_inst.occupied_count, 1)
        self.assertEqual(class_inst.available_spots, 1)
        self.assertEqual(len(class_inst.fixed_students), 1)
        self.assertEqual(len(class_inst.absent_students), 1)

    def test_monthly_credit_isolation_and_expiration(self):
        """Verifica que los créditos se calculen por mes y expiren correctamente."""
        date_june = datetime.date(2026, 6, 22) # Lunes en Junio
        date_july = datetime.date(2026, 7, 20) # Lunes en Julio

        # 1. Alumno A falta en Junio -> Genera crédito para Junio
        crud.release_spot(self.db, self.student_a.id, self.class_monday_18.id, date_june)
        
        credits_june = crud.get_student_credits(self.db, self.student_a.id, date_june)
        self.assertEqual(credits_june.credits_available, 1)
        self.assertEqual(credits_june.credits_earned, 1)
        
        # 2. Comprobar que en Julio sus créditos estén en 0 (expiraron en Junio)
        credits_july = crud.get_student_credits(self.db, self.student_a.id, date_july)
        self.assertEqual(credits_july.credits_available, 0)

    def test_recovery_booking_rules(self):
        """Prueba agendamientos de recuperaciones, consumos de créditos y bloqueos por capacidad."""
        date_june = datetime.date(2026, 6, 22) # Lunes
        
        # 1. Alumno C (libre) intenta recuperar sin créditos -> Debe fallar
        with self.assertRaises(ValueError) as context:
            crud.book_recovery(self.db, self.student_c.id, self.class_monday_18.id, date_june)
        self.assertIn("no dispone de créditos", str(context.exception))

        # 2. Alumno A (fijo) falta, generando 1 crédito
        crud.release_spot(self.db, self.student_a.id, self.class_monday_18.id, date_june)
        
        # 3. Alumno A ahora tiene 1 crédito. Intenta recuperar la clase en la misma fecha y hora -> Debe fallar (ya es fijo/está registrado ahí)
        with self.assertRaises(ValueError) as context:
            crud.book_recovery(self.db, self.student_a.id, self.class_monday_18.id, date_june)
        
        # Crear un horario alternativo para recuperar (Viernes 18:00 hs)
        class_friday_18 = models.ClassTemplate(day_of_week=4, time="18:00", max_capacity=10)
        self.db.add(class_friday_18)
        self.db.commit()

        # 4. Alumno A agenda la recuperación el Viernes -> Exitoso
        friday_date = date_june + datetime.timedelta(days=4)
        crud.book_recovery(self.db, self.student_a.id, class_friday_18.id, friday_date)
        
        # Créditos de Alumno A ahora deben ser 0 (1 ganado, 1 usado)
        credits_june = crud.get_student_credits(self.db, self.student_a.id, date_june)
        self.assertEqual(credits_june.credits_available, 0)
        self.assertEqual(credits_june.credits_used, 1)

    def test_block_when_class_is_full(self):
        """Comprueba que no se pueda agendar una recuperación si el cupo está en su máximo."""
        date_june = datetime.date(2026, 6, 22) # Lunes
        
        # Ocupación inicial: 2 fijos (Clase llena al máximo de 2)
        # Alumno C tiene 1 crédito en Junio (le insertamos una falta ficticia en otra clase de Junio)
        other_class = models.ClassTemplate(day_of_week=1, time="09:00", max_capacity=10)
        self.db.add(other_class)
        self.db.add(models.FixedSchedule(student_id=self.student_c.id, class_template_id=other_class.id))
        self.db.commit()
        crud.release_spot(self.db, self.student_c.id, other_class.id, date_june + datetime.timedelta(days=1))
        
        # Verificar crédito de C
        credits_c = crud.get_student_credits(self.db, self.student_c.id, date_june)
        self.assertEqual(credits_c.credits_available, 1)

        # Alumno C intenta recuperar el Lunes 18:00 (que está lleno, 2/2 ocupados) -> Debe fallar
        with self.assertRaises(ValueError) as context:
            crud.book_recovery(self.db, self.student_c.id, self.class_monday_18.id, date_june)
        self.assertIn("No hay cupos disponibles", str(context.exception))

    def test_cancel_absence_conflict(self):
        """Verifica que el alumno no pueda anular su falta si su lugar ya fue reservado por otro."""
        date_june = datetime.date(2026, 6, 22) # Lunes
        
        # Alumno A reporta falta -> Libera 1 lugar en la clase (queda 1/2 ocupado)
        crud.release_spot(self.db, self.student_a.id, self.class_monday_18.id, date_june)
        
        # Alumno C tiene 1 crédito
        other_class = models.ClassTemplate(day_of_week=1, time="09:00", max_capacity=10)
        self.db.add(other_class)
        self.db.add(models.FixedSchedule(student_id=self.student_c.id, class_template_id=other_class.id))
        self.db.commit()
        crud.release_spot(self.db, self.student_c.id, other_class.id, date_june + datetime.timedelta(days=1))
        
        # Alumno C ocupa el lugar liberado por Alumno A (clase vuelve a estar en 2/2)
        crud.book_recovery(self.db, self.student_c.id, self.class_monday_18.id, date_june)
        
        # Alumno A intenta arrepentirse y cancelar su falta -> Debe fallar porque la clase está llena
        with self.assertRaises(ValueError) as context:
            crud.cancel_absence(self.db, self.student_a.id, self.class_monday_18.id, date_june)
        self.assertIn("el cupo de la clase está lleno", str(context.exception))

    def test_delete_template_cascades(self):
        """Verifica que al eliminar un turno semanal se eliminen en cascada sus asignaciones y bookings."""
        # 1. Comprobar que existen registros para class_monday_18
        schedules_count = self.db.query(models.FixedSchedule).filter(
            models.FixedSchedule.class_template_id == self.class_monday_18.id
        ).count()
        self.assertEqual(schedules_count, 2)
        
        # Crear un booking (falta)
        date_june = datetime.date(2026, 6, 22)
        crud.release_spot(self.db, self.student_a.id, self.class_monday_18.id, date_june)
        bookings_count = self.db.query(models.Booking).filter(
            models.Booking.class_template_id == self.class_monday_18.id
        ).count()
        self.assertEqual(bookings_count, 1)
        
        # 2. Eliminar la plantilla
        success = crud.delete_class_template(self.db, self.class_monday_18.id)
        self.assertTrue(success)
        
        # 3. Verificar que ya no existe la plantilla
        template = crud.get_class_template(self.db, self.class_monday_18.id)
        self.assertIsNone(template)
        
        # 4. Verificar que se eliminaron en cascada sus asignaciones fijas y bookings
        schedules_count = self.db.query(models.FixedSchedule).filter(
            models.FixedSchedule.class_template_id == self.class_monday_18.id
        ).count()
        self.assertEqual(schedules_count, 0)
        
        bookings_count = self.db.query(models.Booking).filter(
            models.Booking.class_template_id == self.class_monday_18.id
        ).count()
        self.assertEqual(bookings_count, 0)

    def test_create_student_with_initial_schedules(self):
        """Verifica que al crear un alumno se le puedan asignar múltiples turnos fijos iniciales."""
        student_in = schemas.StudentCreate(
            name="Nuevo Alumno Test",
            email="nuevo.test@test.com",
            username="nuevotest",
            password="password123",
            initial_class_template_ids=[self.class_monday_18.id]
        )
        new_student = crud.create_student(self.db, student_in)
        self.assertEqual(len(new_student.fixed_schedules), 1)
        self.assertEqual(new_student.fixed_schedules[0].class_template_id, self.class_monday_18.id)

    def test_payments_flow(self):
        """Verifica el flujo completo de registro y consulta de pagos mensuales."""
        # 1. Verificar que inicialmente no tiene pagos
        payments = crud.get_student_payments(self.db, self.student_a.id)
        self.assertEqual(len(payments), 0)

        # 2. Registrar un pago para el mes actual
        payment_in = schemas.PaymentCreate(
            student_id=self.student_a.id,
            month="2026-06",
            amount=8000,
            payment_date=datetime.date(2026, 6, 25)
        )
        payment = crud.create_payment(self.db, payment_in)
        self.assertIsNotNone(payment.id)
        self.assertEqual(payment.amount, 8000)
        self.assertEqual(payment.month, "2026-06")

        # 3. Consultar y verificar el pago registrado
        payments = crud.get_student_payments(self.db, self.student_a.id)
        self.assertEqual(len(payments), 1)
        self.assertEqual(payments[0].amount, 8000)

        # 4. Verificar consulta de pago para un mes específico
        payment_month = crud.get_student_payment_for_month(self.db, self.student_a.id, "2026-06")
        self.assertIsNotNone(payment_month)
        self.assertEqual(payment_month.amount, 8000)

        # 5. Verificar que para un mes no pagado devuelva None
        payment_unpaid = crud.get_student_payment_for_month(self.db, self.student_a.id, "2026-07")
        self.assertIsNone(payment_unpaid)

if __name__ == "__main__":
    unittest.main()
