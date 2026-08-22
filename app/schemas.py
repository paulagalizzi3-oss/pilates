from pydantic import BaseModel, EmailStr
from datetime import date
from typing import List, Optional

# --- Payment Schemas ---
class PaymentBase(BaseModel):
    student_id: int
    month: str # "YYYY-MM"
    amount: int
    payment_date: date

class PaymentCreate(PaymentBase):
    pass

class Payment(PaymentBase):
    id: int

    class Config:
        from_attributes = True


# --- Student Schemas ---
class StudentBase(BaseModel):
    name: str
    email: EmailStr
    username: str

class StudentCreate(StudentBase):
    password: str
    initial_class_template_ids: Optional[List[int]] = None

class FixedScheduleSimple(BaseModel):
    id: int
    class_template_id: int
    day_name: str
    time: str

    class Config:
        from_attributes = True

class Student(StudentBase):
    id: int
    recovery_credits: int # Calculado dinámicamente
    fixed_schedules: List[FixedScheduleSimple] = []
    payments: List[Payment] = []

    class Config:
        from_attributes = True


# --- ClassTemplate Schemas ---
class ClassTemplateBase(BaseModel):
    day_of_week: int # 0 (Lunes) a 4 (Viernes)
    time: str        # "HH:MM"
    max_capacity: int = 10

class ClassTemplateCreate(ClassTemplateBase):
    pass

class ClassTemplate(ClassTemplateBase):
    id: int

    class Config:
        from_attributes = True


# --- FixedSchedule Schemas ---
class FixedScheduleCreate(BaseModel):
    student_id: int
    class_template_id: int

class FixedSchedule(BaseModel):
    id: int
    student_id: int
    class_template_id: int
    student: StudentBase
    class_template: ClassTemplate

    class Config:
        from_attributes = True


# --- Booking Schemas ---
class BookingCreate(BaseModel):
    student_id: int
    class_template_id: int
    date: date
    booking_type: str # 'absence' o 'recovery'

class Booking(BaseModel):
    id: int
    student_id: int
    class_template_id: int
    date: date
    booking_type: str

    class Config:
        from_attributes = True


# --- UI & Business Schemas ---
class StudentSimple(BaseModel):
    id: int
    name: str
    email: str

class ClassInstance(BaseModel):
    """
    Estado calculado de una clase en una fecha específica del calendario.
    """
    class_template_id: int
    day_of_week: int
    time: str
    date: date
    max_capacity: int
    occupied_count: int
    available_spots: int
    fixed_students: List[StudentSimple]
    absent_students: List[StudentSimple]
    recovery_students: List[StudentSimple]

class AgendaDay(BaseModel):
    """
    Agrupación de clases por día del calendario.
    """
    date: date
    day_name: str
    classes: List[ClassInstance]

class StudentCredits(BaseModel):
    student_id: int
    student_name: str
    month: str # "YYYY-MM"
    credits_earned: int
    credits_used: int
    credits_available: int


# --- Admin & Auth Schemas ---
class AdminBase(BaseModel):
    name: str
    username: str

class AdminCreate(AdminBase):
    password: str

class Admin(AdminBase):
    id: int

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    username: str
    password: str
    role: str # 'admin' o 'student'

class LoginResponse(BaseModel):
    success: bool
    id: int
    name: str
    username: str
    role: str

class UpdateCredentialsRequest(BaseModel):
    username: str
    password: Optional[str] = None # Opcional si solo quieren cambiar el usuario
