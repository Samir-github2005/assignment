import { HttpError } from "../models/error.js"
import { Availability } from "../models/availability.js"
import { Appointment } from "../models/appointment.js";
import moment from "moment";
import mongoose from "mongoose";



// Controller to set availability
const setAvailability = async (req, res, next) => {
  try {
    console.log(req.user);  // Log req.user to see if it's coming through

    const { startTime, endTime } = req.body;

    if (!req.user || !req.user.id) {
      return next(new HttpError("No professor ID found", 400));
    }

    // Ensure startTime is before endTime
    if (new Date(startTime) >= new Date(endTime)) {
      return next(new HttpError("Start time must be before end time", 400));
    }

    // Check for overlapping availability
    const existingAvailability = await Availability.findOne({
      professorId: req.user.id,
      $or: [
        { startTime: { $lt: new Date(endTime) }, endTime: { $gt: new Date(startTime) } }, // Start overlaps
        { startTime: { $lt: new Date(startTime) }, endTime: { $gt: new Date(endTime) } }  // End overlaps
      ]
      // New time starts before an old one finishes
      // New time finishes after an old one start
    });

    if (existingAvailability) {
      return next(new HttpError("This time slot is already added for you professor", 400));
    }

    // Create new availability entry
    const availability = new Availability({
      professorId: req.user.id,  // Ensure that professorId is coming from req.user._id
      startTime,
      endTime,
    });

    await availability.save();

    const formattedStartTime = moment.utc(availability.startTime).format('MMMM Do YYYY, h:mm:ss a');
    const formattedEndTime = moment.utc(availability.endTime).format('MMMM Do YYYY, h:mm:ss a');

    res.status(201).json({
      message: "Availability added successfully",
      availability: {
        ...availability.toObject(),  // Spreading existing availability data
        startTime: formattedStartTime, // Replacing with formatted date
        endTime: formattedEndTime, // Replacing  with formatted date
      },
    });
  } catch (error) {
    console.log(error);  // Log error for better debugging
    return next(new HttpError("Adding availability failed", 500));
  }
};


// Controller to update an existing FREE availability slot and must have no booked appointments before
const updateAvailability = async (req, res, next) => {
  try {
    const { availabilityId } = req.params;
    const { startTime, endTime } = req.body;
    const professorId = req.user.id;

    //ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(availabilityId)) {
      return next(new HttpError("invalid availability ID", 400));
    }

    //availability slot
    const availability = await Availability.findById(availabilityId);
    if (!availability) {
      return next(new HttpError("availability slot not found", 404));
    }

    //authorizing
    if (availability.professorId.toString() !== professorId.toString()) {
      return next(new HttpError("unauthorized professor", 403));
    }

    // times checking
    if (!startTime || !endTime) {
      return next(new HttpError("start and end time required", 400));
    }

    const newStart = new Date(startTime);
    const newEnd   = new Date(endTime);

    //start before end
    if (newStart >= newEnd) {
      return next(new HttpError("start time before end time", 400));
    }

    // overlapping slot check
    const overlapping = await Availability.findOne({
      professorId: new mongoose.Types.ObjectId(professorId),
      _id: { $ne: new mongoose.Types.ObjectId(availabilityId) },
      startTime: { $lt: newEnd },
      endTime:   { $gt: newStart },
    });

    if (overlapping) {
      return next(new HttpError("The new time window overlaps with another availability slots", 400));
    }

    // active booking check
    const activeBooking = await Appointment.findOne({
      professorId: new mongoose.Types.ObjectId(professorId),
      status: "booked",
      time: {
        $gte: availability.startTime,
        $lte: availability.endTime,
      },
    });

    if (activeBooking) {
      return next(
        new HttpError(
          "cancel the appointment first",
          400
        )
      );
    }

    // document update
    availability.startTime = newStart;
    availability.endTime   = newEnd;
    await availability.save();
    const formattedStart = moment.utc(availability.startTime).format('MMMM Do YYYY, h:mm:ss a');
    const formattedEnd   = moment.utc(availability.endTime).format('MMMM Do YYYY, h:mm:ss a');

    res.status(200).json({
      message: "Availability updated successfully",
      availability: {
        ...availability.toObject(),
        startTime: formattedStart,
        endTime:   formattedEnd,
      },
    });
  } catch (error) {
    console.log(error);
    return next(new HttpError("Updating availability failed", 500));
  }
};


const cancelAppointments = async (req, res, next) => {
  try {
    const { studentId } = req.params;  // Student's ID from params
    const professorId = req.user.id;   // Professor's ID from the authenticated user
    console.log('Professor ID:', professorId);  // This should match the professor's ID in the appointment
    console.log('Student ID:', studentId);

    // Ensuring professor is authenticated and studentId is provided
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return next(new HttpError("Invalid or missing student ID", 400));
    }

    // Finding the  appointments between this professor and student
    const appointments = await Appointment.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      professorId: new mongoose.Types.ObjectId(professorId),
      status: 'booked' // Only cancel booked appointments
    });

    if (!appointments || appointments.length === 0) {
      return next(new HttpError("No appointments found to cancel", 404));
    }

    // Updating the status of all appointments to "canceled"
    await Appointment.updateMany(
      {
        studentId: new mongoose.Types.ObjectId(studentId),
        professorId: new mongoose.Types.ObjectId(professorId),
        status: 'booked'
      },
      { status: 'canceled' }  //  the status  needs to be canceled
    );

    res.status(200).json({
      message: `All appointments between professor ${professorId} and student ${studentId} have been canceled.,`
    });

  } catch (error) {
    console.error("Error cancelling appointments:", error);
    return next(new HttpError(error));
  }
};
export { setAvailability, updateAvailability, cancelAppointments };