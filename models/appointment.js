import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model (student)
      required: true,
    },
    professorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model (professor)
      required: true,
    },
    time: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["booked", "completed", "cancelled"], // The appointment status
      default: "booked",
    },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

const Appointment = mongoose.model('Appointment', appointmentSchema);
export { Appointment }