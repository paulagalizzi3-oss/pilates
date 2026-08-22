from sqlalchemy import Column, Integer, String, ForeignKey, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    # Relaciones
    fixed_schedules = relationship("FixedSchedule", back_populates="student", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="student", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="student", cascade="all, delete-orphan")


class ClassTemplate(Base):
    """
    Representa un horario semanal fijo (ej. Lunes a las 09:00).
    day_of_week: 0 (Lunes) a 4 (Viernes)
    """
    __tablename__ = "class_templates"

    id = Column(Integer, primary_key=True, index=True)
    day_of_week = Column(Integer, nullable=False)  # 0: Lunes, 1: Martes, 2: Miércoles, 3: Jueves, 4: Viernes
    time = Column(String, nullable=False)           # Formato "HH:MM", ej: "09:00", "18:00"
    max_capacity = Column(Integer, default=10, nullable=False)

    # Relaciones
    fixed_schedules = relationship("FixedSchedule", back_populates="class_template", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="class_template", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("day_of_week", "time", name="uq_day_time"),
    )


class FixedSchedule(Base):
    """
    Horario recurrente asignado a un alumno (ej: Alumno A asiste fijo los Martes a las 10:00).
    """
    __tablename__ = "student_fixed_schedules"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    class_template_id = Column(Integer, ForeignKey("class_templates.id", ondelete="CASCADE"), nullable=False)

    # Relaciones
    student = relationship("Student", back_populates="fixed_schedules")
    class_template = relationship("ClassTemplate", back_populates="fixed_schedules")

    __table_args__ = (
        UniqueConstraint("student_id", "class_template_id", name="uq_student_class"),
    )


class Booking(Base):
    """
    Registra excepciones por fecha específica:
    - 'absence': El alumno FIXED reporta que faltará en esa fecha (libera cupo y genera crédito).
    - 'recovery': El alumno reserva un cupo libre para recuperar clase en esa fecha (consume crédito).
    """
    __tablename__ = "class_bookings"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    class_template_id = Column(Integer, ForeignKey("class_templates.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)            # Fecha específica de la clase (ej: 2026-06-23)
    booking_type = Column(String, nullable=False)  # 'absence' o 'recovery'

    # Relaciones
    student = relationship("Student", back_populates="bookings")
    class_template = relationship("ClassTemplate", back_populates="bookings")

    __table_args__ = (
        UniqueConstraint("student_id", "class_template_id", "date", "booking_type", name="uq_student_booking"),
    )


class Administrator(Base):
    __tablename__ = "administrators"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    month = Column(String, nullable=False)  # Formato "YYYY-MM"
    amount = Column(Integer, nullable=False)
    payment_date = Column(Date, nullable=False)

    student = relationship("Student", back_populates="payments")

    __table_args__ = (
        UniqueConstraint("student_id", "month", name="uq_student_payment_month"),
    )
